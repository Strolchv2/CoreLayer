package dev.corelayer.clanmap.client;

import dev.corelayer.clanmap.net.Packets;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.material.MapColor;

/**
 * Kartensync auf Client-Seite: scannt geladene Chunks zu kompakten Farb-Kacheln, schickt sie an den Clan und
 * nimmt die Kacheln der anderen entgegen. Solange man in keinem Clan ist, wird nichts gesendet oder gespeichert.
 */
public final class MapSync {
    private MapSync() {}

    private static final int TILES_PER_TICK = 3;

    private static final List<MapTileSink> SINKS = new CopyOnWriteArrayList<>();
    /** Eigene Kacheln dieser Sitzung (zum erneuten Senden, wenn jemand dem Clan beitritt). */
    private static final Map<String, Packets.TileUp> OWN = new ConcurrentHashMap<>();
    /** Zuletzt gesendeter Hash je Kachel, damit unveraenderte Chunks nicht erneut gesendet werden. */
    private static final Map<String, Integer> SENT = new ConcurrentHashMap<>();
    /** Von Clanmitgliedern empfangene Kacheln (fuer Adapter, die erst spaeter anschliessen). */
    private static final Map<String, Packets.TileDown> RECEIVED = new ConcurrentHashMap<>();
    private static final ArrayDeque<Packets.TileUp> OUTBOX = new ArrayDeque<>();

    private static boolean wasInClan;
    private static int lastMemberCount;

    public static void registerSink(MapTileSink sink) {
        SINKS.add(sink);
        // Bereits empfangene Kacheln nachliefern.
        RECEIVED.values().forEach(t -> sink.accept(t.dimension(), t.chunkX(), t.chunkZ(), t.colors(), t.from()));
    }

    public static Map<String, Packets.TileDown> receivedTiles() {
        return RECEIVED;
    }

    private static String key(String dim, int cx, int cz) {
        return dim + '|' + cx + '|' + cz;
    }

    // ---- Zustandswechsel -----------------------------------------------------------------------------------

    /** Wird nach jedem neuen {@link Packets.ClanState} aufgerufen. */
    public static void onStateChanged() {
        Packets.ClanState state = ClientClanState.get();
        boolean inClan = state.hasClan();
        int members = state.members().size();
        if (inClan && (!wasInClan || members > lastMemberCount)) {
            // Neues Mitglied (oder wir selbst): alles, was wir kennen, nochmal anbieten.
            SENT.clear();
            synchronized (OUTBOX) {
                OUTBOX.clear();
                OUTBOX.addAll(OWN.values());
            }
        } else if (!inClan) {
            // Sync beendet: nichts mehr senden, Empfangenes verwerfen.
            synchronized (OUTBOX) {
                OUTBOX.clear();
            }
            SENT.clear();
            RECEIVED.clear();
        }
        wasInClan = inClan;
        lastMemberCount = members;
    }

    public static void reset() {
        OWN.clear();
        SENT.clear();
        RECEIVED.clear();
        synchronized (OUTBOX) {
            OUTBOX.clear();
        }
        wasInClan = false;
        lastMemberCount = 0;
    }

    // ---- Senden --------------------------------------------------------------------------------------------

    public static void onChunk(ClientLevel level, LevelChunk chunk) {
        if (level.dimensionType().hasCeiling()) {
            return; // Nether & Co.: Dach-Bedrock ergibt keine brauchbare Karte.
        }
        String dim = level.dimension().identifier().toString();
        int cx = chunk.getPos().x();
        int cz = chunk.getPos().z();

        byte[] colors = new byte[Packets.TILE_BYTES];
        BlockPos.MutableBlockPos pos = new BlockPos.MutableBlockPos();
        for (int z = 0; z < 16; z++) {
            for (int x = 0; x < 16; x++) {
                int top = chunk.getHeight(Heightmap.Types.WORLD_SURFACE, x, z) - 1;
                pos.set(chunk.getPos().getMinBlockX() + x, top, chunk.getPos().getMinBlockZ() + z);
                MapColor color = chunk.getBlockState(pos).getMapColor(chunk, pos);
                colors[z * 16 + x] = (byte) color.id;
            }
        }

        String k = key(dim, cx, cz);
        Packets.TileUp tile = new Packets.TileUp(dim, cx, cz, colors);
        OWN.put(k, tile);

        if (ClientClanState.get().hasClan()) {
            int hash = Arrays.hashCode(colors);
            Integer prev = SENT.put(k, hash);
            if (prev == null || prev != hash) {
                synchronized (OUTBOX) {
                    OUTBOX.add(tile);
                }
            }
        }
    }

    /** Pro Client-Tick ein paar Kacheln aus der Warteschlange senden. */
    public static void tick() {
        if (!ClientClanState.get().hasClan() || !ClientPlayNetworking.canSend(Packets.TileUp.TYPE)) {
            return;
        }
        synchronized (OUTBOX) {
            for (int i = 0; i < TILES_PER_TICK && !OUTBOX.isEmpty(); i++) {
                ClientPlayNetworking.send(OUTBOX.poll());
            }
        }
    }

    // ---- Empfangen -----------------------------------------------------------------------------------------

    public static void onTile(Packets.TileDown tile) {
        if (!ClientClanState.get().hasClan() || tile.colors().length != Packets.TILE_BYTES) {
            return;
        }
        RECEIVED.put(key(tile.dimension(), tile.chunkX(), tile.chunkZ()), tile);
        for (MapTileSink sink : SINKS) {
            sink.accept(tile.dimension(), tile.chunkX(), tile.chunkZ(), tile.colors(), tile.from());
        }
    }
}
