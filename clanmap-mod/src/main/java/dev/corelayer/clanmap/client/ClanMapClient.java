package dev.corelayer.clanmap.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.corelayer.clanmap.ClanMapMod;
import dev.corelayer.clanmap.net.Packets;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientChunkEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import org.lwjgl.glfw.GLFW;

/**
 * Client-Einstieg. Der Hotkey ist ein normales Minecraft-KeyMapping: Standard Numpad-Minus, aenderbar unter
 * Optionen -> Steuerung -> Tastenbelegung -> "Clan Map Sync". Xaero-Hotkeys werden nicht beruehrt.
 */
public final class ClanMapClient implements ClientModInitializer {
    public static KeyMapping openMenu;

    @Override
    public void onInitializeClient() {
        KeyMapping.Category category = KeyMapping.Category.register(ClanMapMod.id("main"));
        openMenu = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.clanmap.open_menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_KP_SUBTRACT, category));

        ClientTickEvents.END_CLIENT_TICK.register(mc -> {
            while (openMenu.consumeClick()) {
                if (mc.level != null && mc.screen == null) {
                    mc.setScreen(new ClanScreen());
                }
            }
            MapSync.tick();
        });

        ClientPlayNetworking.registerGlobalReceiver(Packets.ClanState.TYPE, (payload, ctx) -> {
            ClientClanState.set(payload);
            MapSync.onStateChanged();
            if (Minecraft.getInstance().screen instanceof ClanScreen screen) {
                screen.refresh();
            }
        });
        ClientPlayNetworking.registerGlobalReceiver(Packets.TileDown.TYPE, (payload, ctx) -> MapSync.onTile(payload));

        ClientChunkEvents.CHUNK_LOAD.register((level, chunk) -> MapSync.onChunk(level, chunk));
        // Beim Entladen nochmal scannen: dann ist der Chunk im Endzustand (z. B. nach dem Bauen).
        ClientChunkEvents.CHUNK_UNLOAD.register((level, chunk) -> MapSync.onChunk(level, chunk));

        ClientPlayConnectionEvents.DISCONNECT.register((handler, mc) -> {
            ClientClanState.reset();
            MapSync.reset();
        });
        ClientPlayConnectionEvents.JOIN.register((handler, sender, mc) -> {
            // Zustand beim Server anfordern (falls der JOIN-Broadcast vor dem Client-Setup ankam).
            if (ClientPlayNetworking.canSend(Packets.ClanAction.TYPE)) {
                ClientPlayNetworking.send(new Packets.ClanAction(Packets.Action.REFRESH, Packets.NONE));
            }
        });
    }
}
