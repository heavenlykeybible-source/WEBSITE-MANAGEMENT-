export const PASSWORD_MIN=6;
export const PASSWORD_MAX=128;
export function passwordError(value){
 if(typeof value!=='string'||value.length<PASSWORD_MIN||value.length>PASSWORD_MAX)return 'Use 6 to 128 characters.';
 if(!/\p{Lu}/u.test(value)||!/\p{Ll}/u.test(value))return 'Include at least one uppercase and one lowercase letter.';
 return '';
}
