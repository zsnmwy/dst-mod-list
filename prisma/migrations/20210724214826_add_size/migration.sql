/*
  Warnings:

  - Added the required column `size` to the `Mod` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Mod" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ModId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Mod" ("ModId", "createdAt", "id", "name", "updatedAt", "version") SELECT "ModId", "createdAt", "id", "name", "updatedAt", "version" FROM "Mod";
DROP TABLE "Mod";
ALTER TABLE "new_Mod" RENAME TO "Mod";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
