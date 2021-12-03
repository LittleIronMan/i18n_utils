#!/usr/bin/env node
import minimistParse from 'minimist';
import fs from 'fs';
import path from 'path';
import {err, join2, lowerCaseFirstLetter} from './utils';

interface Options {
    dummy?: never;
}

export function parseArgs(): {options: Options; mainModule: string; allArgs: any} {
    const booleanArgs = [
        /*'clearAll'*/
    ] as string[];
    const cliArgs: any = minimistParse(process.argv.slice(2), {boolean: booleanArgs});

    let mainModule = cliArgs._[0];

    if (typeof mainModule !== 'string') {
        mainModule = './';
    }

    const options: Options = {};

    for (const opt of booleanArgs) {
        options[opt as keyof Options] = cliArgs[opt];
    }

    return {options: options, mainModule: mainModule, allArgs: cliArgs};
}

function scanFiles(dir: string, files: string[]) {
    fs.readdirSync(dir).forEach(file => {
        if (file === 'node_modules') {
            console.log(`Skip scan directory ${file}`);
            return;
        }

        let subpath = join2(dir, file);
        let stat = fs.lstatSync(subpath);

        if (stat.isSymbolicLink()) {
            subpath = fs.realpathSync(subpath);
            stat = fs.lstatSync(subpath);
        }

        if (stat.isDirectory()) {
            scanFiles(subpath, files);
        } else {
            files.push(subpath);
        }
    });
}

function transformSeparatedJsonFilesIntoModules(files: string[]) {
    const modulesWithTranslations: {[key: string]: {namespace: string; langFiles: {[lang: string]: string}}} = {};

    for (const file of files) {
        const splitPath = file.split('/');

        if (splitPath.length < 3) {
            continue;
        }

        const dir = splitPath[splitPath.length - 2];
        // TODO учесть что namespace может храниться в отдельном файле
        const namespace = lowerCaseFirstLetter(splitPath[splitPath.length - 3]);
        const module = splitPath.slice(0, -2).join('/');
        const fileName = splitPath[splitPath.length - 1];

        if (dir === 'translations') {
            const ext = path.extname(fileName);
            const lang = path.basename(fileName, ext);

            if (!modulesWithTranslations[module]) {
                modulesWithTranslations[module] = {namespace, langFiles: {}};
            }

            modulesWithTranslations[module].langFiles[lang] = file;
        }
    }

    for (const module in modulesWithTranslations) {
        const {namespace, langFiles} = modulesWithTranslations[module];
        const accum = {_namespace: namespace} as any;

        for (const lang in langFiles) {
            const path = langFiles[lang];
            const str = fs.readFileSync(path, 'utf-8');
            const data = JSON.parse(str);
            accum[lang] = data;
            fs.unlinkSync(path);
        }

        fs.writeFileSync(module + '/translations.json', JSON.stringify(accum, null, 2), 'utf-8');
    }

    for (const module in modulesWithTranslations) {
        fs.rmSync(module + '/translations', {recursive: true, force: true});
    }

    process.exit(0); // TODO убрать
}

function mergeSeparatedTranslations(files: string[]) {
    const accum = {} as any;

    for (const file of files) {
        const splitPath = file.split('/');

        if (splitPath.length < 3) {
            continue;
        }

        const fileName = splitPath[splitPath.length - 1];
        const dir = splitPath[splitPath.length - 2];
        // TODO нежелательно вычислять namespace на основе названия директориии
        const namespace = lowerCaseFirstLetter(splitPath[splitPath.length - 3]);

        if (dir !== 'translations') {
            continue;
        }

        const ext = path.extname(fileName);
        const lang = path.basename(fileName, ext);

        if (lang.length > 2) {
            console.warn(`Unknown locale "${lang}" in file ${file}`);
            continue;
        }

        if (!accum[lang]) {
            accum[lang] = {};
        }

        accum[lang][namespace] = {};

        const str = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(str);
        // console.log(`file == ${file}, lang == ${lang}`);

        for (const key in data) {
            accum[lang][namespace][key] = data[key];
        }
    }

    console.log(accum);
}

function mergeTranslationModules(files: string[]) {
    const accum = {} as any;

    for (const file of files) {
        const fileName = path.basename(file);

        if (fileName != 'translations.json') {
            continue;
        }

        const str = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(str);

        const namespace = data._namespace;
        if (typeof namespace !== 'string') {
            console.warn(`In file ${file} field "_namespace" expected to be string but ${typeof namespace}`);
        }
        delete data._namespace;

        for (const lang in data) {
            if (!accum[lang]) {
                accum[lang] = {};
            }

            accum[lang][namespace] = {};

            for (const key in data[lang]) {
                accum[lang][namespace][key] = data[lang][key];
            }
        }
    }

    return accum;
}

if (require.main === module) {
    const parsed = parseArgs();

    const files: string[] = [];
    scanFiles(parsed.mainModule, files);
    // console.log(files);

    const merged = mergeTranslationModules(files);
    const outDir = path.join(parsed.mainModule, 'translations');

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir);
    }

    for (const lang in merged) {
        fs.writeFileSync(path.join(outDir, lang + '.json'), JSON.stringify(merged[lang], null, 2));
    }
}
