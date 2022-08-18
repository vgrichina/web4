function quotedAttribute(name: string, value: string): string {
    return `${name}="${value.replaceAll('"', '&quot;')}"`;
}

export class HtmlAttributes {
    id: string | null;
    name: string | null;
    className: string | null;
    style: string | null;

    toString(): string {
        let result = "";
        if (this.id) {
            result += quotedAttribute("id", this.id!);
        }
        if (this.name) {
            result += quotedAttribute("name", this.name!);
        }
        if (this.className) {
            result += quotedAttribute("class", this.className!);
        }
        if (this.style) {
            result += quotedAttribute("style", this.style!);
        }
        return result;
    }
}

export class HtmlFormAttributes extends HtmlAttributes {
    action: string | null;
    method: string = "POST";

    toString(): string {
        let result = super.toString();
        if (this.action) {
            result += quotedAttribute("action", this.action!);
        }
        if (this.method) {
            result += quotedAttribute("method", this.method);
        }
        return result;
    }
}

export function htmlTag(tagName: string, attrs: HtmlAttributes, content: string[] | null = null): string {
    return `<${tagName} ${attrs}>${content ? content.join('\n') : ''}</${tagName}>`;
}

export function form(attrs: HtmlFormAttributes, content: string[] | null = null): string {
    return htmlTag('form', attrs, content);
}

export function textarea(attrs: HtmlAttributes, content: string[] | null = null): string {
    return htmlTag('textarea', attrs, content);
}

export function button(attrs: HtmlAttributes, content: string[] | null = null): string {
    return htmlTag('button', attrs, content);
}

