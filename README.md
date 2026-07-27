# Indiro api server (second version)

## Description

[Public api](https://indiro.ru/api-v2/docs/) for projects.

## Installation

```bash
$ npm install
```

## Web Push

Generate VAPID keys once and store them in production env:

```bash
$ npx web-push generate-vapid-keys
```

Required variables:

```bash
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=
```

## Error Logs

Errors are stored in MongoDB and can be viewed from the backend:

```bash
https://indiro.ru/api-v2/error-logs/view?token=YOUR_ERROR_LOG_VIEW_TOKEN
```

Optional variables:

```bash
ERROR_LOG_VIEW_TOKEN=
ERROR_LOG_RETENTION_DAYS=90
```

If `ERROR_LOG_VIEW_TOKEN` is not set, error log endpoints are available only with the usual Bearer JWT authorization.

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
