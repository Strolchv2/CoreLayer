package dev.corelayer.clanmap.client;

import java.util.UUID;

/**
 * Anschlusspunkt fuer Karten-Mods. Jede von einem Clanmitglied empfangene Kachel wird an alle
 * registrierten Sinks gereicht (siehe {@link MapSync#registerSink}). Ein Xaero-Adapter haengt sich hier ein.
 */
@FunctionalInterface
public interface MapTileSink {
    /**
     * @param dimension Dimension als Identifier-String, z. B. {@code minecraft:overworld}
     * @param chunkX    Chunk-X-Koordinate
     * @param chunkZ    Chunk-Z-Koordinate
     * @param colors    256 MapColor-IDs, Index = localZ * 16 + localX
     * @param from      Clanmitglied, das die Kachel gescannt hat
     */
    void accept(String dimension, int chunkX, int chunkZ, byte[] colors, UUID from);
}
