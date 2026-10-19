import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
registerHooks({resolve(specifier,context,next){if(specifier.startsWith('.')&&context.parentURL?.endsWith('.ts')&&!/\.[a-z]+$/.test(specifier)){const candidate=new URL(specifier+'.ts',context.parentURL);if(existsSync(candidate))return next(candidate.href,context);}return next(specifier,context);}});
