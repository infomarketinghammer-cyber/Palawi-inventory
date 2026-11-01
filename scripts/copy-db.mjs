// Copies every collection from one MongoDB database to another, keeping document ids.
// The target must be empty (run `prisma db push` against it first so indexes exist); nothing is deleted anywhere.
// Usage: node scripts/copy-db.mjs <sourceUri> <sourceDb> <targetUri> <targetDb>
import { MongoClient } from "mongodb";

const [srcUri, srcDb, dstUri, dstDb] = process.argv.slice(2);
if (!dstDb) throw new Error("Usage: node scripts/copy-db.mjs <sourceUri> <sourceDb> <targetUri> <targetDb>");

const src = new MongoClient(srcUri);
const dst = new MongoClient(dstUri);
await Promise.all([src.connect(), dst.connect()]);
const from = src.db(srcDb);
const to = dst.db(dstDb);

for (const { name } of await to.listCollections().toArray()) {
  if ((await to.collection(name).estimatedDocumentCount()) > 0) throw new Error(`Target ${dstDb}.${name} is not empty; refusing to copy.`);
}

const BATCH = 1000;
for (const { name } of (await from.listCollections().toArray()).filter((c) => !c.name.startsWith("system."))) {
  let batch = [];
  let copied = 0;
  for await (const doc of from.collection(name).find()) {
    batch.push(doc);
    if (batch.length === BATCH) {
      await to.collection(name).insertMany(batch, { ordered: true });
      copied += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await to.collection(name).insertMany(batch, { ordered: true });
    copied += batch.length;
  }
  const sourceCount = await from.collection(name).countDocuments();
  console.log(`${name.padEnd(18)} ${String(copied).padStart(6)} copied${copied === sourceCount ? "" : `  MISMATCH (source ${sourceCount})`}`);
}
await Promise.all([src.close(), dst.close()]);
