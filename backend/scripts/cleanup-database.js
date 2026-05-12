/* eslint-disable no-console */
const mongoose = require("mongoose");
const User = require("../src/models/User");
const AdminProfile = require("../src/models/AdminProfile");
const env = require("../src/config/env");

function parseFlags(argv) {
  const flags = new Set(argv.slice(2));

  return {
    apply: flags.has("--apply"),
    dropTestDb: flags.has("--drop-test-db"),
    dryRun: !flags.has("--apply"),
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getRegisteredPortal(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return "customer";
  }

  if (env.superAdminAllowedEmails.includes(normalizedEmail)) {
    return "superadmin";
  }

  if (env.adminAllowedEmails.includes(normalizedEmail)) {
    return "admin";
  }

  return "customer";
}

function stringifyId(value) {
  return value ? String(value) : "";
}

function cloneDocument(document) {
  return { ...document };
}

function stripMongoMeta(document) {
  const nextDocument = cloneDocument(document);
  delete nextDocument._id;
  delete nextDocument.__v;
  return nextDocument;
}

async function maybeDeleteUnreferencedUser(destinationDb, userId, apply) {
  const references = await Promise.all([
    destinationDb.collection("orders").countDocuments({ userId }),
    destinationDb.collection("reviews").countDocuments({ userId }),
    destinationDb.collection("wishlistitems").countDocuments({ userId }),
    destinationDb.collection("access_requests").countDocuments({ requestedById: userId }),
  ]);

  const hasReferences = references.some((count) => count > 0);

  if (!hasReferences && apply) {
    await destinationDb.collection("users").deleteOne({ _id: new mongoose.Types.ObjectId(userId) }).catch(() => null);
  }

  return { hasReferences };
}

async function migrateUsers(sourceDb, destinationDb, apply) {
  const userIdMap = new Map();
  const sourceUsers = await sourceDb.collection("users").find({}).toArray();

  for (const sourceUser of sourceUsers) {
    const email = normalizeEmail(sourceUser.email);

    if (!email) {
      continue;
    }

    const portal = getRegisteredPortal(email);
    const sourceUserId = stringifyId(sourceUser._id);

    if (portal === "customer") {
      const existingUser = await destinationDb.collection("users").findOne({ email });

      if (existingUser) {
        userIdMap.set(sourceUserId, stringifyId(existingUser._id));

        if (apply) {
          await destinationDb.collection("users").updateOne(
            { email },
            {
              $set: {
                googleId: sourceUser.googleId || null,
                email,
                displayName: sourceUser.displayName || email.split("@")[0],
                photoURL: sourceUser.photoURL || null,
                role: "customer",
                authProvider: sourceUser.authProvider || "google",
                passwordHash: sourceUser.passwordHash || null,
                oauth: sourceUser.oauth || existingUser.oauth || {},
                updatedAt: sourceUser.updatedAt || existingUser.updatedAt || new Date(),
              },
            }
          );
        }
      } else {
        userIdMap.set(sourceUserId, sourceUserId);

        if (apply) {
          await destinationDb.collection("users").insertOne({
            ...stripMongoMeta(sourceUser),
            email,
            displayName: sourceUser.displayName || email.split("@")[0],
            role: "customer",
            authProvider: sourceUser.authProvider || "google",
            passwordHash: sourceUser.passwordHash || null,
          });
        }
      }

      continue;
    }

    const existingAdmin = await destinationDb.collection("admin_profiles").findOne({ email });
    const nextRole = portal === "superadmin" ? "superadmin" : "admin";

    if (existingAdmin) {
      userIdMap.set(sourceUserId, stringifyId(existingAdmin._id));

      if (apply) {
        await destinationDb.collection("admin_profiles").updateOne(
          { email },
          {
            $set: {
              googleId: sourceUser.googleId || existingAdmin.googleId || null,
              displayName: sourceUser.displayName || existingAdmin.displayName || email.split("@")[0],
              photoURL: sourceUser.photoURL || existingAdmin.photoURL || null,
              provider: sourceUser.authProvider || existingAdmin.provider || "google",
              role: existingAdmin.role === "superadmin" ? "superadmin" : nextRole,
              lastAdminLoginAt: sourceUser.updatedAt || existingAdmin.lastAdminLoginAt || new Date(),
              loginCount: Number(existingAdmin.loginCount || 0),
              active: true,
              updatedAt: sourceUser.updatedAt || existingAdmin.updatedAt || new Date(),
            },
          }
        );
      }
    } else {
      userIdMap.set(sourceUserId, sourceUserId);

      if (apply) {
        await destinationDb.collection("admin_profiles").insertOne({
          googleId: sourceUser.googleId || null,
          email,
          displayName: sourceUser.displayName || email.split("@")[0],
          photoURL: sourceUser.photoURL || null,
          provider: sourceUser.authProvider || "google",
          role: nextRole,
          lastAdminLoginAt: sourceUser.updatedAt || new Date(),
          loginCount: 0,
          active: true,
          createdAt: sourceUser.createdAt || new Date(),
          updatedAt: sourceUser.updatedAt || new Date(),
        });
      }
    }

    if (apply) {
      await destinationDb.collection("users").deleteOne({ email });
    }
  }

  return userIdMap;
}

function remapReferencedIds(document, userIdMap) {
  const nextDocument = cloneDocument(document);

  if (nextDocument.userId && userIdMap.has(stringifyId(nextDocument.userId))) {
    nextDocument.userId = userIdMap.get(stringifyId(nextDocument.userId));
  }

  if (nextDocument.requestedById && userIdMap.has(stringifyId(nextDocument.requestedById))) {
    nextDocument.requestedById = userIdMap.get(stringifyId(nextDocument.requestedById));
  }

  return nextDocument;
}

async function upsertByFilter(destinationCollection, filter, replacementDocument, apply) {
  const existing = await destinationCollection.findOne(filter);

  if (!apply) {
    return { action: existing ? "update" : "insert" };
  }

  if (existing) {
    await destinationCollection.updateOne({ _id: existing._id }, { $set: stripMongoMeta(replacementDocument) });
    return { action: "update" };
  }

  await destinationCollection.insertOne(replacementDocument);
  return { action: "insert" };
}

async function migrateGenericCollection(sourceDb, destinationDb, collectionName, userIdMap, apply) {
  const sourceCollection = sourceDb.collection(collectionName);
  const destinationCollection = destinationDb.collection(collectionName);
  const documents = await sourceCollection.find({}).toArray();

  let migrated = 0;

  for (const sourceDocument of documents) {
    const nextDocument = remapReferencedIds(sourceDocument, userIdMap);

    if (collectionName === "admin_profiles") {
      const email = normalizeEmail(nextDocument.email);
      if (!email) {
        continue;
      }

      const existingAdmin = await destinationCollection.findOne({ email });

      if (existingAdmin) {
        if (apply) {
          await destinationCollection.updateOne(
            { _id: existingAdmin._id },
            {
              $set: {
                googleId: nextDocument.googleId || existingAdmin.googleId || null,
                email,
                displayName: nextDocument.displayName || existingAdmin.displayName || email.split("@")[0],
                photoURL: nextDocument.photoURL || existingAdmin.photoURL || null,
                provider: nextDocument.provider || existingAdmin.provider || "google",
                role: existingAdmin.role === "superadmin" || nextDocument.role === "superadmin" ? "superadmin" : "admin",
                lastAdminLoginAt: nextDocument.lastAdminLoginAt || existingAdmin.lastAdminLoginAt || new Date(),
                loginCount: Math.max(Number(existingAdmin.loginCount || 0), Number(nextDocument.loginCount || 0)),
                active: true,
              },
            }
          );
        }
      } else if (apply) {
        await destinationCollection.insertOne(stripMongoMeta(nextDocument));
      }

      migrated += 1;
      continue;
    }

    if (collectionName === "waitlists") {
      const filter = { email: nextDocument.email };
      await upsertByFilter(destinationCollection, filter, stripMongoMeta(nextDocument), apply);
      migrated += 1;
      continue;
    }

    if (collectionName === "wishlistitems") {
      const filter = { userId: nextDocument.userId, productId: nextDocument.productId };
      await upsertByFilter(destinationCollection, filter, stripMongoMeta(nextDocument), apply);
      migrated += 1;
      continue;
    }

    if (collectionName === "reviews") {
      const filter = { productId: nextDocument.productId, userId: nextDocument.userId };
      await upsertByFilter(destinationCollection, filter, stripMongoMeta(nextDocument), apply);
      migrated += 1;
      continue;
    }

    if (collectionName === "access_requests") {
      const hasPendingAdminApproval =
        nextDocument.requestType === "admin_approval" && nextDocument.targetEmail && nextDocument.status === "pending";
      const filter = hasPendingAdminApproval
        ? {
            requestType: nextDocument.requestType,
            targetEmail: nextDocument.targetEmail,
            status: nextDocument.status,
          }
        : { _id: nextDocument._id };

      await upsertByFilter(destinationCollection, filter, stripMongoMeta(nextDocument), apply);
      migrated += 1;
      continue;
    }

    if (collectionName === "orders" || collectionName === "products" || collectionName === "reviews") {
      await upsertByFilter(destinationCollection, { _id: nextDocument._id }, stripMongoMeta(nextDocument), apply);
      migrated += 1;
      continue;
    }

    await upsertByFilter(destinationCollection, { _id: nextDocument._id }, stripMongoMeta(nextDocument), apply);
    migrated += 1;
  }

  return migrated;
}

async function migrateTestDatabaseIntoStitchmart({ apply, dropTestDb }) {
  if (!dropTestDb) {
    return { migratedCollections: 0, migratedDocuments: 0, message: "test database migration not requested" };
  }

  const client = mongoose.connection.getClient();
  const sourceDb = client.db("test");
  const destinationDb = mongoose.connection.db;
  const sourceCollections = await sourceDb.listCollections().toArray();
  const collectionNames = sourceCollections.map((collection) => collection.name).filter((name) => !name.startsWith("system."));

  if (collectionNames.length === 0) {
    return { migratedCollections: 0, migratedDocuments: 0, message: "test database is empty or missing" };
  }

  const userIdMap = await migrateUsers(sourceDb, destinationDb, apply);
  let migratedDocuments = 0;

  for (const collectionName of collectionNames) {
    if (collectionName === "users") {
      continue;
    }

    const count = await migrateGenericCollection(sourceDb, destinationDb, collectionName, userIdMap, apply);
    migratedDocuments += count;
  }

  return {
    migratedCollections: collectionNames.length,
    migratedDocuments,
    message: apply ? "migrated test database into stitchmart" : "dry-run: would migrate test database into stitchmart",
  };
}

async function normalizePortalAccounts(destinationDb, apply) {
  const adminAllowlist = new Set(env.adminAllowedEmails);
  const superAdminAllowlist = new Set(env.superAdminAllowedEmails);
  const userAccounts = await destinationDb.collection("users").find({}).toArray();
  const adminProfiles = await destinationDb.collection("admin_profiles").find({}).toArray();

  let deletedUsers = 0;
  let updatedUsers = 0;

  for (const user of userAccounts) {
    const email = normalizeEmail(user.email);

    if (!email) {
      continue;
    }

    const portal = superAdminAllowlist.has(email) ? "superadmin" : adminAllowlist.has(email) ? "admin" : "customer";

    if (portal !== "customer") {
      const references = await Promise.all([
        destinationDb.collection("orders").countDocuments({ userId: stringifyId(user._id) }),
        destinationDb.collection("reviews").countDocuments({ userId: stringifyId(user._id) }),
        destinationDb.collection("wishlistitems").countDocuments({ userId: stringifyId(user._id) }),
        destinationDb.collection("access_requests").countDocuments({ requestedById: stringifyId(user._id) }),
      ]);

      const canDelete = references.every((count) => count === 0);

      if (canDelete) {
        if (apply) {
          await destinationDb.collection("users").deleteOne({ _id: user._id });
        }
        deletedUsers += 1;
        continue;
      }
    }

    if (user.role !== "customer") {
      updatedUsers += 1;
      if (apply) {
        await destinationDb.collection("users").updateOne({ _id: user._id }, { $set: { role: "customer" } });
      }
    }
  }

  let updatedAdmins = 0;
  for (const admin of adminProfiles) {
    const email = normalizeEmail(admin.email);
    const portal = superAdminAllowlist.has(email) ? "superadmin" : adminAllowlist.has(email) ? "admin" : null;

    if (portal && admin.role !== portal) {
      updatedAdmins += 1;
      if (apply) {
        await destinationDb.collection("admin_profiles").updateOne({ _id: admin._id }, { $set: { role: portal } });
      }
    }
  }

  return { deletedUsers, updatedUsers, updatedAdmins };
}

async function main() {
  const flags = parseFlags(process.argv);

  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.mongoUri, { autoIndex: true });

  try {
    const destinationDb = mongoose.connection.db;
    const dbName = destinationDb.databaseName;
    console.log(`Connected to database: ${dbName}`);

    const before = {
      users: await destinationDb.collection("users").countDocuments({}),
      admins: await destinationDb.collection("admin_profiles").countDocuments({}),
      superadmins: await destinationDb.collection("admin_profiles").countDocuments({ role: "superadmin" }),
    };

    console.log("Before cleanup:", before);
    console.log("Mode:", flags.apply ? "apply" : "dry-run");

    const migrationResult = await migrateTestDatabaseIntoStitchmart(flags);
    console.log("Test database migration:", migrationResult);

    const portalResult = await normalizePortalAccounts(destinationDb, flags.apply);
    console.log("Portal normalization:", portalResult);

    if (flags.apply) {
      const sourceClient = mongoose.connection.getClient();
      const testDb = sourceClient.db("test");
      const databases = await sourceClient.db().admin().listDatabases();
      const hasTestDb = (databases.databases || []).some((database) => database.name === "test");

      if (hasTestDb) {
        await testDb.dropDatabase();
        console.log("Dropped test database");
      } else {
        console.log("No test database found to drop");
      }
    } else {
      console.log("Dry-run complete. Re-run with --apply to make changes.");
    }

    const after = {
      users: await destinationDb.collection("users").countDocuments({}),
      admins: await destinationDb.collection("admin_profiles").countDocuments({}),
      superadmins: await destinationDb.collection("admin_profiles").countDocuments({ role: "superadmin" }),
    };

    console.log("After cleanup:", after);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Database cleanup failed:", error);
  process.exit(1);
});