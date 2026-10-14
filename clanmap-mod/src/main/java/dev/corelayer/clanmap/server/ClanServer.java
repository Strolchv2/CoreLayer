package dev.corelayer.clanmap.server;

import dev.corelayer.clanmap.net.Packets;
import dev.corelayer.clanmap.net.Packets.Action;
import dev.corelayer.clanmap.net.Packets.Entry;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.storage.LevelResource;

/** Server-Seite: nimmt Clan-Aktionen entgegen, verteilt den Zustand und leitet Kartenkacheln an den Clan weiter. */
public final class ClanServer {
    private ClanServer() {}

    /** Maximal erlaubte Kacheln pro Spieler und Sekunde (Schutz vor Flut). */
    private static final int MAX_TILES_PER_SECOND = 80;

    private static ClanManager manager;
    private static final Map<UUID, long[]> RATE = new HashMap<>();

    public static void init() {
        ServerLifecycleEvents.SERVER_STARTING.register(server ->
                manager = new ClanManager(server.getWorldPath(LevelResource.ROOT).resolve("clanmap-clans.json")));
        ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
            manager = null;
            RATE.clear();
        });

        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayer player = handler.getPlayer();
            manager.rememberName(player.getUUID(), player.getName().getString());
            // Alle aktualisieren, damit die Spielerliste "hat Mod" stimmt.
            broadcastState(server);
        });
        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            RATE.remove(handler.getPlayer().getUUID());
            server.execute(() -> broadcastState(server));
        });

        ServerPlayNetworking.registerGlobalReceiver(Packets.ClanAction.TYPE,
                (payload, ctx) -> handleAction(ctx.server(), ctx.player(), payload));
        ServerPlayNetworking.registerGlobalReceiver(Packets.TileUp.TYPE,
                (payload, ctx) -> relayTile(ctx.server(), ctx.player(), payload));
    }

    // ---- Aktionen ------------------------------------------------------------------------------------------

    private static void handleAction(MinecraftServer server, ServerPlayer player, Packets.ClanAction a) {
        UUID me = player.getUUID();
        UUID other = a.target();
        Set<UUID> affected = new HashSet<>(manager.clanOf(me));
        affected.add(me);
        affected.add(other);
        affected.addAll(manager.clanOf(other));

        ClanManager.Result result = ClanManager.Result.OK;
        switch (a.action()) {
            case REFRESH -> { }
            case INVITE -> {
                ServerPlayer target = server.getPlayerList().getPlayer(other);
                if (target == null || !ServerPlayNetworking.canSend(target, Packets.ClanState.TYPE)) {
                    result = new ClanManager.Result("clanmap.err.offline");
                } else {
                    result = manager.invite(me, other);
                    if (result.ok()) {
                        player.sendSystemMessage(Component.translatable("clanmap.msg.invite_sent", name(target)));
                        target.sendSystemMessage(Component.translatable("clanmap.msg.invited", name(player)));
                    }
                }
            }
            case ACCEPT -> {
                result = manager.accept(me, other);
                if (result.ok()) {
                    for (UUID id : manager.clanOf(me)) {
                        ServerPlayer p = server.getPlayerList().getPlayer(id);
                        if (p == null) {
                            continue;
                        }
                        p.sendSystemMessage(id.equals(me)
                                ? Component.translatable("clanmap.msg.you_joined", manager.name(other))
                                : Component.translatable("clanmap.msg.joined", name(player)));
                    }
                }
            }
            case DECLINE -> {
                result = manager.decline(me, other);
                ServerPlayer inviter = server.getPlayerList().getPlayer(other);
                if (result.ok() && inviter != null) {
                    inviter.sendSystemMessage(Component.translatable("clanmap.msg.declined", name(player)));
                }
            }
            case LEAVE -> {
                Set<UUID> before = manager.clanOf(me);
                boolean wasLeader = manager.isLeader(me);
                result = manager.leave(me);
                if (result.ok()) {
                    affected.addAll(before);
                    for (UUID id : before) {
                        ServerPlayer p = server.getPlayerList().getPlayer(id);
                        if (p == null) {
                            continue;
                        }
                        if (id.equals(me)) {
                            p.sendSystemMessage(Component.translatable("clanmap.msg.you_left"));
                        } else if (wasLeader) {
                            p.sendSystemMessage(Component.translatable("clanmap.msg.disbanded"));
                        } else {
                            p.sendSystemMessage(Component.translatable("clanmap.msg.left", name(player)));
                        }
                    }
                }
            }
            case KICK -> {
                result = manager.kick(me, other);
                if (result.ok()) {
                    ServerPlayer kicked = server.getPlayerList().getPlayer(other);
                    if (kicked != null) {
                        kicked.sendSystemMessage(Component.translatable("clanmap.msg.kicked"));
                    }
                }
            }
        }

        if (!result.ok()) {
            player.sendSystemMessage(Component.translatable(result.errorKey()));
        }
        for (UUID id : affected) {
            ServerPlayer p = server.getPlayerList().getPlayer(id);
            if (p != null) {
                sendState(server, p);
            }
        }
    }

    // ---- Zustand -------------------------------------------------------------------------------------------

    private static void broadcastState(MinecraftServer server) {
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            sendState(server, p);
        }
    }

    private static void sendState(MinecraftServer server, ServerPlayer player) {
        if (manager == null || !ServerPlayNetworking.canSend(player, Packets.ClanState.TYPE)) {
            return;
        }
        UUID me = player.getUUID();
        UUID leader = manager.leaderOf(me);

        List<Entry> members = new ArrayList<>();
        if (leader != null) {
            // Anfuehrer zuerst, dann der Rest.
            members.add(new Entry(leader, nameOf(server, leader)));
            for (UUID id : manager.clanOf(me)) {
                if (!id.equals(leader)) {
                    members.add(new Entry(id, nameOf(server, id)));
                }
            }
        }
        List<Entry> invites = new ArrayList<>();
        for (UUID id : manager.pendingInvites(me)) {
            invites.add(new Entry(id, nameOf(server, id)));
        }
        List<UUID> modPlayers = new ArrayList<>();
        for (ServerPlayer p : server.getPlayerList().getPlayers()) {
            if (ServerPlayNetworking.canSend(p, Packets.ClanState.TYPE)) {
                modPlayers.add(p.getUUID());
            }
        }
        ServerPlayNetworking.send(player,
                new Packets.ClanState(leader == null ? Packets.NONE : leader, members, invites, modPlayers));
    }

    // ---- Kartensync ----------------------------------------------------------------------------------------

    private static void relayTile(MinecraftServer server, ServerPlayer from, Packets.TileUp tile) {
        if (tile.colors().length != Packets.TILE_BYTES || !allow(from.getUUID())) {
            return;
        }
        for (UUID id : manager.clanOf(from.getUUID())) {
            if (id.equals(from.getUUID())) {
                continue;
            }
            ServerPlayer target = server.getPlayerList().getPlayer(id);
            if (target != null && ServerPlayNetworking.canSend(target, Packets.TileDown.TYPE)) {
                ServerPlayNetworking.send(target, new Packets.TileDown(
                        from.getUUID(), tile.dimension(), tile.chunkX(), tile.chunkZ(), tile.colors()));
            }
        }
    }

    private static boolean allow(UUID id) {
        long now = System.currentTimeMillis();
        long[] window = RATE.computeIfAbsent(id, k -> new long[] {now, 0});
        if (now - window[0] >= 1000) {
            window[0] = now;
            window[1] = 0;
        }
        return ++window[1] <= MAX_TILES_PER_SECOND;
    }

    // ---- Namen ---------------------------------------------------------------------------------------------

    private static String name(ServerPlayer p) {
        return p.getName().getString();
    }

    private static String nameOf(MinecraftServer server, UUID id) {
        ServerPlayer p = server.getPlayerList().getPlayer(id);
        return p != null ? name(p) : manager.name(id);
    }
}
