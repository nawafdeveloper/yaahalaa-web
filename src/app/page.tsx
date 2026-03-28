"use client"

import ArchiveSectionLargeSidebar from "@/components/archive-section-large-sidebar";
import ChatRoomSection from "@/components/chat-room-section";
import ChatsSectionLargeSideBar from "@/components/chats-section-large-sidebar";
import EmptyStartChating from "@/components/empty-start-chating";
import ProfileSectionLargeSidebar from "@/components/profile-section-large-sidebar";
import SettingsSectionSideBar from "@/components/settings-section-large-sidebar";
import mockChats from "@/mocks/chat-items";
import { useSidebarStore } from "@/store/use-active-sidebar-store";
import React from "react";

export default function AppPage() {
  const { activeSideBar } = useSidebarStore();

  return (
    <div className="w-full h-screen max-h-screen min-h-screen">
      <div className="flex md:hidden">
        {activeSideBar === 'main-chat' && (
          <ChatsSectionLargeSideBar data={mockChats} />
        )}
        {activeSideBar === 'main-setting' && (
          <SettingsSectionSideBar />
        )}
        {activeSideBar === 'main-archive' && (
          <ArchiveSectionLargeSidebar />
        )}
        {activeSideBar === 'main-profile' && (
          <ProfileSectionLargeSidebar />
        )}
      </div>
      <div className="hidden md:flex w-full h-full">
        {activeSideBar === 'main-chat' || activeSideBar === 'create-chat' ? (
          <ChatRoomSection />
        ) : (
          <EmptyStartChating />
        )}
      </div>
    </div>
  );
}