# asmv-js

A JavaScript implementation of the ASIMOV protocol (Asynchronous Service Interaction Messaging OVerlay).

See the individual packages for the documentation:

- [@asmv/core](./packages/core/README.md)
- [@asmv/koa](./packages/koa/README.md)
- [@asmv/utils](./packages/utils/README.md)

## Development

This is a monorepo managed by the [Nx](https://nx.dev/).

**How to add package?**

```bash
npx nx generate @nrwl/js:library <package> --bundler=tsc --publishable --importPath @asmv/<package>
```

## License

Copyright 2023 Jiri Hybek <jiri(at)hybek.cz> and contributors.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.