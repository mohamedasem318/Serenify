# Contract: Crisis Resource Table

## Shape

```ts
export type CrisisCountry = "EG" | "US";

export type CrisisResourceRow = {
  country: CrisisCountry;
  name: string;
  number: string;
  url: string | null;
  last_checked: "2026-06-28";
};
```

## Rows

```json
[
  {
    "country": "EG",
    "name": "General Secretariat of Mental Health & Addiction Treatment hotline",
    "number": "16328",
    "url": null,
    "last_checked": "2026-06-28"
  },
  {
    "country": "US",
    "name": "988 Suicide & Crisis Lifeline",
    "number": "Call/text 988",
    "url": null,
    "last_checked": "2026-06-28"
  }
]
```

## Universal Emergency Line

The crisis panel always includes a universal line telling the employee to contact local emergency services if they are in immediate danger. If the employee country is missing or unsupported, the panel still renders this universal line and must not be blank.

Egypt-specific rendering also includes emergency number `123`.

## Model Boundary

Ren must not generate phone numbers, hotline names, service names, or country-specific crisis resources. All such content comes only from this verified app table and universal line.

## Privacy Boundary

Rendering the panel does not create a crisis row, event, telemetry field, dashboard badge, manager route, admin route, or employer notification.

