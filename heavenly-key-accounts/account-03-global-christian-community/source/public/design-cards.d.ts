export const CATEGORIES: string[][];
export const POST_GUIDES: {id:string;name:string;kind:string;title:string;body:string}[];
export const FEATURED_CARD_PRESETS: string[][];
export const REPORT_REASONS: string[][];
export const COMMUNITY_RULES: string[];
export interface DesignSettings {templateId:string;alignment:string;fontSize:string;size:string;decoration:string}
export interface VideoLink {provider:string;url:string;embedUrl:string|null;canEmbed:boolean}
export function validatePostPresentation(input:any):{format:string;category:string;title:string;body:string;scripture:string;design:DesignSettings|null;video:VideoLink|null};
