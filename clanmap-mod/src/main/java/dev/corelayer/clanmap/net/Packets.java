package dev.corelayer.clanmap.net;

import dev.corelayer.clanmap.ClanMapMod;
import io.netty.buffer.ByteBuf;
import java.util.List;
import java.util.UUID;
import net.minecraft.core.UUIDUtil;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/** Alle Netzwerkpakete der Mod. Clan-Aktionen laufen client->server, Zustand und Kartendaten server->client. */
public final class Packets {
    private Packets() {}

    /** Platzhalter fuer "kein Clan". */
    public static final UUID NONE = new UUID(0L, 0L);

    /** Kartenkachel = ein Chunk, 16x16 MapColor-IDs. */
    public static final int TILE_BYTES = 16 * 16;

    public enum Action {
        INVITE, ACCEPT, DECLINE, LEAVE, KICK, REFRESH;

        static final StreamCodec<ByteBuf, Action> CODEC = ByteBufCodecs.VAR_INT.map(
                i -> values()[Math.floorMod(i, values().length)], Action::ordinal);
    }

    public record Entry(UUID id, String name) {
        public static final StreamCodec<ByteBuf, Entry> CODEC = StreamCodec.composite(
                UUIDUtil.STREAM_CODEC, Entry::id,
                ByteBufCodecs.stringUtf8(64), Entry::name,
                Entry::new);
    }

    /** Client -> Server: eine Clan-Aktion. {@code target} ist je nach Aktion Zielspieler oder Einladender. */
    public record ClanAction(Action action, UUID target) implements CustomPacketPayload {
        public static final Type<ClanAction> TYPE = new Type<>(ClanMapMod.id("clan_action"));
        public static final StreamCodec<ByteBuf, ClanAction> CODEC = StreamCodec.composite(
                Action.CODEC, ClanAction::action,
                UUIDUtil.STREAM_CODEC, ClanAction::target,
                ClanAction::new);

        @Override
        public Type<ClanAction> type() {
            return TYPE;
        }
    }

    /**
     * Server -> Client: kompletter Zustand aus Sicht des Empfaengers.
     *
     * @param leader      Clan-Anfuehrer oder {@link #NONE}
     * @param members     Clanmitglieder inkl. Anfuehrer
     * @param invites     offene Einladungen fuer den Empfaenger (Einladende)
     * @param modPlayers  alle Online-Spieler, die die Mod installiert haben (nur die sind einladbar)
     */
    public record ClanState(UUID leader, List<Entry> members, List<Entry> invites, List<UUID> modPlayers)
            implements CustomPacketPayload {
        public static final Type<ClanState> TYPE = new Type<>(ClanMapMod.id("clan_state"));
        public static final StreamCodec<ByteBuf, ClanState> CODEC = StreamCodec.composite(
                UUIDUtil.STREAM_CODEC, ClanState::leader,
                Entry.CODEC.apply(ByteBufCodecs.list(256)), ClanState::members,
                Entry.CODEC.apply(ByteBufCodecs.list(256)), ClanState::invites,
                UUIDUtil.STREAM_CODEC.apply(ByteBufCodecs.list(1024)), ClanState::modPlayers,
                ClanState::new);

        public static final ClanState EMPTY = new ClanState(NONE, List.of(), List.of(), List.of());

        public boolean hasClan() {
            return !NONE.equals(leader);
        }

        @Override
        public Type<ClanState> type() {
            return TYPE;
        }
    }

    /** Client -> Server: eine selbst gescannte Kartenkachel fuer den eigenen Clan. */
    public record TileUp(String dimension, int chunkX, int chunkZ, byte[] colors) implements CustomPacketPayload {
        public static final Type<TileUp> TYPE = new Type<>(ClanMapMod.id("tile_up"));
        public static final StreamCodec<ByteBuf, TileUp> CODEC = StreamCodec.composite(
                ByteBufCodecs.stringUtf8(64), TileUp::dimension,
                ByteBufCodecs.VAR_INT, TileUp::chunkX,
                ByteBufCodecs.VAR_INT, TileUp::chunkZ,
                ByteBufCodecs.byteArray(TILE_BYTES), TileUp::colors,
                TileUp::new);

        @Override
        public Type<TileUp> type() {
            return TYPE;
        }
    }

    /** Server -> Client: Kachel eines Clanmitglieds. */
    public record TileDown(UUID from, String dimension, int chunkX, int chunkZ, byte[] colors)
            implements CustomPacketPayload {
        public static final Type<TileDown> TYPE = new Type<>(ClanMapMod.id("tile_down"));
        public static final StreamCodec<ByteBuf, TileDown> CODEC = StreamCodec.composite(
                UUIDUtil.STREAM_CODEC, TileDown::from,
                ByteBufCodecs.stringUtf8(64), TileDown::dimension,
                ByteBufCodecs.VAR_INT, TileDown::chunkX,
                ByteBufCodecs.VAR_INT, TileDown::chunkZ,
                ByteBufCodecs.byteArray(TILE_BYTES), TileDown::colors,
                TileDown::new);

        @Override
        public Type<TileDown> type() {
            return TYPE;
        }
    }
}
