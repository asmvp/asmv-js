# @asmv/transport-core

HTTP transport library for the JavaScript implementation of the ASIMOV protocol (Asynchronous Service Interaction Messaging OVerlay).

This library is an extension to the `@asmv/core` and provides types, schemas and utility functions specific for the HTTP transport protocol specification. You can use this library to implement an ASIMOV client and service over the HTTP protocol.

For ready-to-use client and service implementations, see the following packages:

- [@asmv/koa](../service/README.md) Koa framework middlewares to implement both agent and service.

## Overview

The library contains:

- Types and JSON (ajv) schemas for HTTP endpoint requests and responses.

## Development

This library was generated with [Nx](https://nx.dev) and is a part of the `asmv-js` monorepo.

### Building

Run `nx build core` to build the library.

### Running unit tests

Run `nx test core` to execute the unit tests via [Jest](https://jestjs.io).

## License

Copyright 2023 Jiri Hybek <jiri(at)hybek.cz> and contributors.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.