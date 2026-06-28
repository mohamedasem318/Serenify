"""Shared OpenAI-compatible chat-completions adapter (private).

Both providers in 011 (Groq and LM Studio) speak the OpenAI `/chat/completions`
shape, so the wire logic lives here once and the two public adapters
(`groq_provider`, `lm_studio_provider`) are thin name/endpoint wrappers. We call it
over plain async `httpx` — NOT a vendor SDK — so Principle IV's "no vendor SDK"
holds even inside the boundary.
"""

from __future__ import annotations

import time
from typing import Any

import httpx

from .config import ProviderEndpoint
from .provider import LLMProvider, LLMProviderError, LLMRequest, LLMResponse


class OpenAICompatProvider(LLMProvider):
    """An `LLMProvider` backed by an OpenAI-compatible chat-completions endpoint."""

    def __init__(
        self,
        endpoint: ProviderEndpoint,
        *,
        request_timeout_ms: int = 20000,
        client: httpx.AsyncClient | None = None,
        require_api_key: bool = True,
    ) -> None:
        self.name = endpoint.name
        self._endpoint = endpoint
        self._timeout_ms = request_timeout_ms
        self._client = client
        self._require_api_key = require_api_key

    def _build_payload(self, request: LLMRequest) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._endpoint.model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
        }
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        if request.max_tokens is not None:
            payload["max_tokens"] = request.max_tokens
        if request.response_format == "json_object":
            payload["response_format"] = {"type": "json_object"}
        # Per-request override wins; otherwise the endpoint default (low for gpt-oss).
        effort = request.reasoning_effort or self._endpoint.reasoning_effort
        if effort is not None:
            payload["reasoning_effort"] = effort
        return payload

    async def complete(self, request: LLMRequest) -> LLMResponse:
        if self._require_api_key and not self._endpoint.api_key:
            # Fail-clean: a missing key is a configuration problem, not transient.
            raise LLMProviderError(
                "missing api key", provider=self.name, retryable=False
            )

        url = f"{self._endpoint.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self._endpoint.api_key:
            headers["Authorization"] = f"Bearer {self._endpoint.api_key}"

        timeout_s = (request.timeout_ms or self._timeout_ms) / 1000.0
        payload = self._build_payload(request)

        started = time.monotonic()
        try:
            if self._client is not None:
                resp = await self._client.post(
                    url, json=payload, headers=headers, timeout=timeout_s
                )
            else:
                async with httpx.AsyncClient(timeout=timeout_s) as client:
                    resp = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise LLMProviderError(
                "request timed out", provider=self.name, retryable=True, timeout=True
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(
                "transport error", provider=self.name, retryable=True
            ) from exc

        latency_ms = int((time.monotonic() - started) * 1000)

        if resp.status_code >= 400:
            # 429 / 5xx are worth a retry; other 4xx are config/contract errors.
            retryable = resp.status_code == 429 or resp.status_code >= 500
            raise LLMProviderError(
                f"http {resp.status_code}", provider=self.name, retryable=retryable
            )

        try:
            data = resp.json()
            choice = data["choices"][0]
            message = choice.get("message") or {}
            # Reasoning models return reasoning in a SEPARATE field; we read only
            # `content` and ignore any `reasoning`/`reasoning_content` so hidden
            # reasoning never leaves the boundary. Defensive extraction of stray
            # reasoning that leaked INTO content is the scorer's job.
            content = message.get("content")
            finish = choice.get("finish_reason") or "stop"
        except (KeyError, IndexError, ValueError, TypeError) as exc:
            raise LLMProviderError(
                "malformed provider response", provider=self.name, retryable=False
            ) from exc

        finish_reason = finish if finish in {
            "stop", "length", "tool_calls", "content_filter", "error"
        } else "stop"

        return LLMResponse(
            provider=self.name,
            model=str(data.get("model") or self._endpoint.model),
            content=content or "",
            finish_reason=finish_reason,  # type: ignore[arg-type]
            latency_ms=latency_ms,
        )
