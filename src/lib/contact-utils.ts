import type { Contact, ContactPayload } from "@/types/contacts.type";

export function normalizePhoneNumber(value: string): string {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, "");

    if (!digits) {
        return "";
    }

    return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function buildFullPhoneNumber(
    dialCode: string | undefined,
    phoneNumber: string
): string {
    const normalizedDialCode = normalizePhoneNumber(dialCode ?? "");
    const localDigits = phoneNumber.replace(/\D/g, "");

    if (!normalizedDialCode || !localDigits) {
        return normalizePhoneNumber(`${normalizedDialCode}${localDigits}`);
    }

    return `${normalizedDialCode}${localDigits}`;
}

export function deriveContactLetterGroup({
    contact_first_name,
    contact_second_name,
    contact_number,
}: ContactPayload): string {
    const source =
        contact_first_name?.trim() ||
        contact_second_name?.trim() ||
        contact_number.trim();
    const firstCharacter = source.charAt(0).toUpperCase();

    return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
}

export function toContactDisplayName(contact: Pick<
    Contact,
    "contact_first_name" | "contact_second_name" | "contact_number"
>): string {
    const fullName = `${contact.contact_first_name ?? ""} ${
        contact.contact_second_name ?? ""
    }`
        .trim()
        .replace(/\s+/g, " ");

    return fullName || contact.contact_number;
}

export function createContactSearchValue(contact: Contact): string {
    return [
        contact.contact_first_name,
        contact.contact_second_name,
        toContactDisplayName(contact),
        contact.contact_number,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}
