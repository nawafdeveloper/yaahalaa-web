"use client"

import ArchiveSectionLargeSidebar from "@/components/archive-section-large-sidebar";
import ChatRoomSection from "@/components/chat-room-section";
import ChatsSectionLargeSideBar from "@/components/chats-section-large-sidebar";
import EmptyStartChating from "@/components/empty-start-chating";
import SettingsSectionSideBar from "@/components/settings-section-large-sidebar";
import WallpaperPreview from "@/components/wallpeper-preview";
import { useLogout } from "@/hooks/use-logout";
import { getLocaleFromCookie, isRTLClient } from "@/lib/locale-client";
import mockChats from "@/mocks/chat-items";
import { useSettingsStore } from "@/store/use-active-setting-store";
import { useSidebarStore } from "@/store/use-active-sidebar-store";
import React from "react";

export default function AppPage() {
  const { activeSideBar } = useSidebarStore();
  const locale = getLocaleFromCookie();
  const isRTL = locale ? isRTLClient(locale) : false;
  const { logout } = useLogout(isRTL);
  const { activeSettingsSubsection } = useSettingsStore();

  return (
    <div className="w-full h-screen max-h-screen min-h-screen">
      <div className="flex md:hidden">
        {activeSideBar === 'main-chat' && (
          <ChatsSectionLargeSideBar logout={logout} data={mockChats} />
        )}
        {activeSideBar === 'main-setting' && (
          <SettingsSectionSideBar />
        )}
        {activeSideBar === 'main-archive' && (
          <ArchiveSectionLargeSidebar />
        )}
      </div>
      <div className="hidden md:flex w-full h-full">
        {activeSettingsSubsection === 'chat-wallpaper' ? (
          <WallpaperPreview />
        ) : (
          <>
            {activeSideBar === 'main-chat' || activeSideBar === 'create-chat' ? (
              <ChatRoomSection />
            ) : (
              <EmptyStartChating />
            )}
          </>
        )}
      </div>
    </div>
  );
}