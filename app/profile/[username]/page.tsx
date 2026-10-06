"use client";

import { useParams } from "next/navigation";
import { PlayerProfileView } from "../profile-view";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  return <PlayerProfileView requestedUsername={params.username} />;
}
