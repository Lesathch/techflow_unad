import * as domain from './domain.mjs';
import { launch } from './core/server.mjs';
await launch('techflow', domain, 3002);
