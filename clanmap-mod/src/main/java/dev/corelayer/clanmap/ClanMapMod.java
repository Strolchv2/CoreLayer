package dev.corelayer.clanmap;

import dev.corelayer.clanmap.net.Packets;
import dev.corelayer.clanmap.server.ClanServer;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.resources.Identifier;

/** Gemeinsamer Einstiegspunkt: registriert die Netzwerkpakete und startet die Server-Logik. */
public final class ClanMapMod implements ModInitializer {
    public static final String MOD_ID = "clanmap";

    public static Identifier id(String path) {
        return Identifier.fromNamespaceAndPath(MOD_ID, path);
    }

    @Override
    public void onInitialize() {
        PayloadTypeRegistry.playC2S().register(Packets.ClanAction.TYPE, Packets.ClanAction.CODEC);
        PayloadTypeRegistry.playC2S().register(Packets.TileUp.TYPE, Packets.TileUp.CODEC);
        PayloadTypeRegistry.playS2C().register(Packets.ClanState.TYPE, Packets.ClanState.CODEC);
        PayloadTypeRegistry.playS2C().register(Packets.TileDown.TYPE, Packets.TileDown.CODEC);

        ClanServer.init();
    }
}
