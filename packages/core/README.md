# @asmv/core

Core library for the JavaScript implementation of the [ASIMOV](#todo) protocol (Asynchronous Service Interaction Messaging OVerlay).

This library is supposed to be used as a base for the custom client or service implementation and is transport protocol agnostic.

For ready-to-use implementations, see the following packages:

- [@asmv/transport-http](#todo) HTTP overlay package, can be used to implement custom HTTP agents and services.
- [@asmv/koa](#todo) Koa framework middlewares to implement both agent and service.

## Overview

The library contains:

- Service manifest definition types and JSON (ajv) schemas
- Message definition types and JSON (ajv) schemas
- Client context - usefull for the client implementations
- Service context - usefull for the service implementations of a command executor
- Utility functions for async operations

Contexts provide usefull methods for sending and receiving messages, as well as for managing an execution state.

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