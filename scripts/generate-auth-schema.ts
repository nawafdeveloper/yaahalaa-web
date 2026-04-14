import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSchema } from "better-auth/db";
import { authSharedOptions } from "../src/lib/auth-config";

type BetterAuthSchema = ReturnType<typeof getSchema>;
type BetterAuthField = BetterAuthSchema[string]["fields"][string];

const schema = getSchema(authSharedOptions);

function toSnakeCase(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/-/g, "_")
        .toLowerCase();
}

function toCamelCase(value: string): string {
    return value.replace(/[-_](\w)/g, (_, character: string) => character.toUpperCase());
}

function pluralize(value: string): string {
    if (value.endsWith("y")) {
        return `${value.slice(0, -1)}ies`;
    }

    if (value.endsWith("s")) {
        return `${value}es`;
    }

    return `${value}s`;
}

function getColumnName(fieldKey: string, field: BetterAuthField): string {
    return toSnakeCase(field.fieldName ?? fieldKey);
}

function escapeString(value: string): string {
    return JSON.stringify(value);
}

function formatDefaultValue(field: BetterAuthField): string | null {
    if (field.defaultValue === undefined) {
        return null;
    }

    if (typeof field.defaultValue === "function") {
        return field.type === "date" ? ".defaultNow()" : null;
    }

    if (typeof field.defaultValue === "string") {
        return `.default(${escapeString(field.defaultValue)})`;
    }

    if (typeof field.defaultValue === "number" || typeof field.defaultValue === "boolean") {
        return `.default(${String(field.defaultValue)})`;
    }

    if (field.defaultValue instanceof Date) {
        return null;
    }

    return null;
}

function formatField(fieldKey: string, field: BetterAuthField): string {
    const columnName = getColumnName(fieldKey, field);
    let builder: string;

    if (field.type === "string") {
        builder = `text(${escapeString(columnName)})`;
    } else if (field.type === "boolean") {
        builder = `boolean(${escapeString(columnName)})`;
    } else if (field.type === "date") {
        builder = `timestamp(${escapeString(columnName)})`;
    } else if (field.type === "number") {
        builder = `${field.bigint ? "bigint" : "integer"}(${escapeString(columnName)})`;
    } else {
        throw new Error(`Unsupported Better Auth field type for Drizzle generation: ${String(field.type)}`);
    }

    if (field.references) {
        const referencedTableName = field.references.model;
        const referencedFieldName = field.references.field;

        builder += `.references(() => ${toCamelCase(referencedTableName)}.${toCamelCase(referencedFieldName)}, { onDelete: ${escapeString(field.references.onDelete ?? "cascade")} })`;
    }

    if (field.unique) {
        builder += ".unique()";
    }

    const defaultValue = formatDefaultValue(field);
    if (defaultValue) {
        builder += defaultValue;
    } else if (field.type === "date" && field.onUpdate && field.required !== false) {
        builder += ".defaultNow()";
    }

    if (field.onUpdate && field.type === "date") {
        builder += ".$onUpdate(() => /* @__PURE__ */ new Date())";
    }

    if (field.required !== false) {
        builder += ".notNull()";
    }

    return `    ${fieldKey}: ${builder},`;
}

function formatTable(tableName: string, table: BetterAuthSchema[string]): string {
    const variableName = toCamelCase(tableName);
    const fieldEntries = Object.entries(table.fields);
    const fields = [
        '    id: text("id").primaryKey(),',
        ...fieldEntries.map(([fieldKey, field]) => formatField(fieldKey, field)),
    ].join("\n");
    const indexedFields = fieldEntries.filter(([, field]) => field.index);

    if (indexedFields.length === 0) {
        return `export const ${variableName} = pgTable(${escapeString(tableName)}, {\n${fields}\n});`;
    }

    const indexes = indexedFields
        .map(([fieldKey]) => `index(${escapeString(`${tableName}_${fieldKey}_idx`)}).on(table.${fieldKey})`)
        .join(",\n        ");

    return `export const ${variableName} = pgTable(\n    ${escapeString(tableName)},\n    {\n${fields}\n    },\n    (table) => [${indexes ? `\n        ${indexes},\n    ` : ""}],\n);`;
}

function formatRelations(): string {
    const outboundRelations: string[] = [];
    const inboundRelations = new Map<string, string[]>();

    for (const [tableName, table] of Object.entries(schema)) {
        const relationEntries = Object.entries(table.fields).filter(([, field]) => field.references);
        if (relationEntries.length > 0) {
            const variableName = toCamelCase(tableName);
            const modelRelations = relationEntries.map(([fieldKey, field]) => {
                const reference = field.references!;
                const referencedTableName = reference.model;
                const relationName = toCamelCase(referencedTableName);
                const referencedVariableName = toCamelCase(referencedTableName);
                const referencedFieldName = toCamelCase(reference.field);

                if (!inboundRelations.has(referencedTableName)) {
                    inboundRelations.set(referencedTableName, []);
                }

                inboundRelations.get(referencedTableName)!.push(
                    `    ${pluralize(variableName)}: many(${variableName}),`,
                );

                return `    ${relationName}: one(${referencedVariableName}, {\n        fields: [${variableName}.${fieldKey}],\n        references: [${referencedVariableName}.${referencedFieldName}],\n    }),`;
            });

            outboundRelations.push(
                `export const ${variableName}Relations = relations(${variableName}, ({ one }) => ({\n${modelRelations.join("\n")}\n}));`,
            );
        }
    }

    const inboundRelationBlocks = Object.entries(schema)
        .filter(([tableName]) => inboundRelations.has(tableName))
        .map(([tableName]) => {
            const variableName = toCamelCase(tableName);
            const entries = Array.from(new Set(inboundRelations.get(tableName)!));

            return `export const ${variableName}Relations = relations(${variableName}, ({ many }) => ({\n${entries.join("\n")}\n}));`;
        });

    return [...inboundRelationBlocks, ...outboundRelations].join("\n\n");
}

function buildSchemaFile(): string {
    const orderedTables = Object.entries(schema).sort((left, right) => left[1].order - right[1].order);
    const tables = orderedTables.map(([tableName, table]) => formatTable(tableName, table)).join("\n\n");
    const relationBlocks = formatRelations();
    const schemaExport = orderedTables
        .map(([tableName]) => `    ${toCamelCase(tableName)},`)
        .join("\n");

    return `import { relations } from "drizzle-orm";
import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    index,
} from "drizzle-orm/pg-core";

// This file is generated from Better Auth. Run \`npm run auth:generate-schema\` to refresh it.

${tables}

${relationBlocks}

export const schema = {
${schemaExport}
};
`;
}

const output = buildSchemaFile();

for (const outputPath of ["src/db/schema.ts", "auth-schema.ts"]) {
    writeFileSync(resolve(outputPath), output, "utf8");
}
