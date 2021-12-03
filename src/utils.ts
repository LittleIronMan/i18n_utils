import path from 'path';

// export const defaultConfigFileName = 'envConfig.json';

export function lowerCaseFirstLetter(str: string) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

export function err(e: any) {
    let msg = 'unknown';

    if (typeof e === 'string') {
        msg = e;
    } else if (typeof e === 'object' && e.message) {
        msg = e.message;
    }

    console.error('Error: ' + msg);
    process.exit();
}

export function join2(a: string, b: string): string {
    return path.join(a, b).replace(/\\/g, '/');
}

// https://stackoverflow.com/a/41407246
const UNDERLINE = '\x1b[4m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
export const OVERWRITE_LINE = '\x1b[0G';
export const header = (s: string) => UNDERLINE + s + RESET;
export const highlight = (s: string) => YELLOW + s + RESET;
export const secret = (s: string) => BLUE + s + RESET;
