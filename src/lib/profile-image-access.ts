import db from "@/db";
import { contacts, encryptedMedia, user } from "@/db/schema";
import { canViewProfilePicture } from "@/lib/profile-picture-privacy";
import {
    resolveRecipientMediaKeyForUser,
    userHasDirectMediaRecipientKey,
} from "@/lib/message-media-access";
import { and, eq } from "drizzle-orm";

type ProfileImageMediaRecord = NonNullable<
    Awaited<ReturnType<typeof findProfileImageMediaRecord>>
>;

export async function findProfileImageMediaRecord(objectKey: string) {
    return db.query.encryptedMedia.findFirst({
        where: eq(encryptedMedia.objectKey, objectKey),
    });
}

export async function ownerHasUserAsContact(ownerUserId: string, userId: string) {
    if (!ownerUserId || !userId) {
        return false;
    }

    const contact = await db.query.contacts.findFirst({
        where: and(
            eq(contacts.owner_user_id, ownerUserId),
            eq(contacts.linked_user_id, userId)
        ),
        columns: {
            contact_id: true,
        },
    });

    return Boolean(contact);
}

function resolveProfileImageKeyForUser(
    mediaRecord: ProfileImageMediaRecord,
    userId: string
) {
    if (mediaRecord.ownerId === userId) {
        return (
            resolveRecipientMediaKeyForUser(mediaRecord.aesKey, userId) ??
            mediaRecord.aesKey
        );
    }

    if (!userHasDirectMediaRecipientKey(mediaRecord.aesKey, userId)) {
        return null;
    }

    return resolveRecipientMediaKeyForUser(mediaRecord.aesKey, userId);
}

export async function authorizeProfileImageAccess({
    mediaRecord,
    requesterUserId,
}: {
    mediaRecord: ProfileImageMediaRecord;
    requesterUserId: string;
}) {
    const isOwner = mediaRecord.ownerId === requesterUserId;
    const encryptedAesKey = resolveProfileImageKeyForUser(
        mediaRecord,
        requesterUserId
    );

    if (isOwner) {
        return {
            canAccess: Boolean(encryptedAesKey),
            encryptedAesKey,
        };
    }

    const owner = await db.query.user.findFirst({
        where: eq(user.id, mediaRecord.ownerId),
        columns: {
            whoCanSeeProfilePicture: true,
        },
    });
    const requesterIsOwnerContact = await ownerHasUserAsContact(
        mediaRecord.ownerId,
        requesterUserId
    );
    const privacyAllows = canViewProfilePicture(
        owner?.whoCanSeeProfilePicture,
        requesterIsOwnerContact
    );

    return {
        canAccess: privacyAllows && Boolean(encryptedAesKey),
        encryptedAesKey: privacyAllows ? encryptedAesKey : null,
    };
}
