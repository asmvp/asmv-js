/**
 * @package @asmv/core
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 See the LICENSE.md file distributed with this source code for licensing info.
 */

import * as fs from "fs";

import { ServiceManifest } from "../lib/Manifest/ManifestSchemas";
import { Message } from "../lib/Messages/MessageSchemas";

function invariant(condition: boolean, message: string) {
    if (!condition) {
        console.error(message);
        process.exit(1);
    }
}

invariant(process.argv.length === 3, "Usage: node exportSchemas.js <output_dir>");
const outputDir = process.argv[2];

fs.writeFileSync(`${outputDir}/manifest.json`, JSON.stringify(ServiceManifest, null, 4));
fs.writeFileSync(`${outputDir}/manifest.min.json`, JSON.stringify(ServiceManifest));

fs.writeFileSync(`${outputDir}/message.json`, JSON.stringify(Message, null, 4));
fs.writeFileSync(`${outputDir}/message.min.json`, JSON.stringify(Message));
