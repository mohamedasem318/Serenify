"""Server-side logging configuration for the anchor API.

apps/api ships no logging config, so under uvicorn the ``ml_video`` package's
INFO records are swallowed by Python's WARNING-default root logger — in
particular the usable-face-coverage gate's reject line
(``usable-face-coverage reject: usable=… kept=… fraction=…``, DECISION-31),
whose ``usable``/``kept``/``fraction`` counts are deliberately **server-log-only**
and never reach the wire (Constitution Principle I / FR-016). This attaches a
single stderr handler to the service's own (``app``) and the ``ml_video``
loggers at a configurable level.

It is intentionally NOT ``logging.basicConfig`` (the temporary 006 diagnostic
that was removed) and intentionally does NOT reconfigure the root logger: the
named loggers carry their own handler with ``propagate=False`` so uvicorn's
root/``uvicorn.access`` handlers are left intact and nothing is logged twice.
``disable_existing_loggers`` is False so a later uvicorn ``dictConfig`` leaves
these loggers (and their handler) untouched. Pure server-side — it changes no
HTTP response or client contract.
"""

from __future__ import annotations

from logging.config import dictConfig

# Logger namespaces whose records we surface server-side. Configured explicitly
# rather than via the root logger so uvicorn's own logging is left alone and
# records are not emitted twice.
_LOGGERS = ("app", "ml_video")


def configure_logging(level: str = "INFO") -> None:
    """Install one stderr handler on the ``app`` and ``ml_video`` loggers.

    ``level`` (e.g. from ``LOG_LEVEL``): ``INFO`` surfaces the coverage-gate
    reject line; ``DEBUG`` additionally surfaces the decode-sampling diagnostic
    (``pipeline.extract_landmarks``, gated by ``logger.isEnabledFor(DEBUG)``).
    Idempotent — re-running resets the handler list rather than stacking it.
    """
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "serenify": {
                    "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stderr",
                    "formatter": "serenify",
                },
            },
            "loggers": {
                name: {
                    "handlers": ["console"],
                    "level": level.upper(),
                    "propagate": False,
                }
                for name in _LOGGERS
            },
        }
    )
