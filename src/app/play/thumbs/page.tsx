import { permanentRedirect } from "next/navigation";

export default function ThumbWarsPage() {
  permanentRedirect("/play/thumbs/daily");
}
