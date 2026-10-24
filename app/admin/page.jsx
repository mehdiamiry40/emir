import {
  ACCEPTED_ATTACHMENT_TYPES,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
} from "../../lib/attachments";
import { MAX_NOTE_LENGTH } from "../../lib/notes";
import { SITE_NAME } from "../site";
import AdminDashboard from "./dashboard";

export const metadata = {
  title: `${SITE_NAME} — Admin`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = "force-static";

export default function AdminPage() {
  return (
    <AdminDashboard
      maxLength={MAX_NOTE_LENGTH}
      accept={ACCEPTED_ATTACHMENT_TYPES}
      types={ATTACHMENT_TYPES}
      maxAttachments={MAX_ATTACHMENTS}
      maxBytes={MAX_ATTACHMENT_BYTES}
    />
  );
}
