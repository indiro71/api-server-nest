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

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
