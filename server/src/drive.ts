import { google } from "googleapis";
import * as stream from "stream";
import * as dotenv from "dotenv";

dotenv.config();

function getDriveClient() {
    const clientId = process.env.GDRIVE_CLIENT_ID;
    const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Google Drive OAuth credentials in environment variables.");
    }

    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    return google.drive({ version: "v3", auth: oAuth2Client });
}

export async function uploadFileToDrive(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const drive = getDriveClient();
    const folderId = process.env.GDRIVE_FOLDER_ID;

    if (!folderId) {
        throw new Error("Missing GDRIVE_FOLDER_ID in environment variables");
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    const fileMetadata = {
        name: filename,
        parents: [folderId],
    };

    const media = {
        mimeType: mimeType,
        body: bufferStream,
    };

    const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: "id",
    });

    if (!file.data.id) {
        throw new Error("Failed to upload file to Google Drive. No file ID returned.");
    }

    return file.data.id;
}

export async function getFileStreamFromDrive(fileId: string): Promise<stream.Readable> {
    const drive = getDriveClient();

    const res = await drive.files.get(
        { fileId: fileId, alt: "media" },
        { responseType: "stream" }
    );

    return res.data;
}
