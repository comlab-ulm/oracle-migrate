import * as fs from "fs";
import {execSync} from "child_process";
import {getConnection} from "oracledb";

const correctTablesChain = [
    "templates", "regexes", "caches", "logs", "multilangs", "table_logs", "languages",
    "locales", "licenses", "user_types", "text_types", "countries", "rights", "country_languages",
    "options", "return_values", "services", "settings", "calcelements",
    "companies", "company_licenses", "company_options",
    "user_groups", "user_group_options", "configs", "translations",
    "users", "user_options", "user_rights", "messages",
    "term_categories", "term_category_chain", "term_category_users_groups_companies",
    "terms", "term_settings", "term_descriptions", "term_to_category", "term_category_replacement",
    "benchmark_templates", "benchmarks", "benchmark_calcelements", "benchmark_users_groups_companies", "benchmark_settings",
    "archive_folders", "archive_tag", "archive", "archive_to_tags",
    "archive_users_groups_companies", "allow_lists"];

async function main(pathToSqlcl, ddlFileName, fileName, username, password, host, port, database, schema) {

    const connection = await getConnection({
        user: username,
        password: password,
        connectString: `${host}:${port}/${database}`
    });

    const createTableFile = fs.createWriteStream(ddlFileName, {
        flags: 'w'
    });

    const insertFile = fs.createWriteStream(fileName, {
        flags: 'w'
    });

    for (const tableName of correctTablesChain) {
        console.log('DLL table:', tableName);
        let newID = 0;
        try {
            const getId = await connection.execute(`select max("id") "max" from "${tableName}"`);
            //console.log(getId);
            newID = parseInt(getId['rows'][0][0], 10);
        } catch (e) {
            console.log('no id to update');
        }
        console.log('maxId', newID);

        // DDL

        const cre = await connection.execute(`select dbms_metadata.get_ddl('TABLE', '${tableName}') from dual`);
        if (cre) {
            const lob = cre['rows'][0][0];
            let creString = await lob.getData();
            if (newID > 0) {
                creString = creString.replace(/INCREMENT BY 1 START WITH [0-9]+/, `INCREMENT BY 1 START WITH ` + newID);
            }
            creString = creString.replace(new RegExp(`"${schema}"\\.`, 'gi'), '');
            // ENABLE STORAGE IN ROW 4000 CHUNK 8192
            creString = creString.replace(new RegExp(`ENABLE STORAGE IN ROW 4000 CHUNK 8192`, 'gi'), '');
            // SEGMENT CREATION DEFERRED
            creString = creString.replace(new RegExp(`SEGMENT CREATION DEFERRED`, 'gi'), '');
            createTableFile.write(creString + ";\n");

        }


    }

    // insert tables data
    for (const tableName of correctTablesChain) {
        console.log('backup table:', tableName);
        execSync(`env NLS_LANG=GERMAN_GERMANY.AL32UTF8 printf "set sqlformat insert \nselect * from \\"${tableName}\\";\nquit" | env NLS_LANG=GERMAN_GERMANY.AL32UTF8 ${pathToSqlcl}  ${username}/${password}@${host}:${port}/${database} > ./output.sql`);
        // get file
        let res = fs.readFileSync("./output.sql");
        let insertString = res.toString().split('\n');

        // remove all before SET DEFINE OFF;
        const defineOffIndex = insertString.indexOf('SET DEFINE OFF;');
        if (defineOffIndex === -1) {
            console.log('not found "SET DEFINE OFF;"');
            continue;
        }

        insertString.splice(0, defineOffIndex);

        if (insertString.length < 6) {
            console.log('no data');
            continue;
        }

        // remove last 5 lines

        insertString.splice(-4);

        if (insertString[insertString.length - 1].match(/^\d+ Zeilen ausgewählt. $/)) {
            insertString.pop();
        }

        if (insertString) {
            let putString = insertString.join('\n').replace(/TO_CLOB\(q'\[(.+?)]'\)([,\n)])/g,
                (match, p1, p2) => {
                    if (p1.match(/]$/)) {
                        return `TO_CLOB(q'#${p1}#')` + p2;
                    }
                    return `TO_CLOB(q'[${p1}]')` + p2;
                });

            insertFile.write('\nSET SQLBL ON;\n' + putString + "\ncommit;\n");
        }
    }
    insertFile.write("\nquit\n");
    return true;
}

(async () => {
    if (process.argv.length === 11) {
        const ddlFileName = process.argv[2];
        const fileName = process.argv[3];
        const pathToSqlcl = process.argv[4];
        const username = process.argv[5];
        const password = process.argv[6];
        const host = process.argv[7];
        const port = process.argv[8];
        const database = process.argv[9];
        const schema = process.argv[10];
        console.log({pathToSqlcl, ddlFileName, fileName, username, password, host, port, database, schema});
        await main(pathToSqlcl, ddlFileName, fileName, username, password, host, port, database, schema);
        console.log('DONE!');
    } else {
        console.log('Usage index.js ddlFileName fileName pathToSqlcl username password host port database schema)');
    }
})();