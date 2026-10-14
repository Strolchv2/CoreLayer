package dev.corelayer.clanmap.client;

import dev.corelayer.clanmap.net.Packets.ClanState;
import java.util.UUID;

/** Letzter vom Server empfangener Clan-Zustand. */
public final class ClientClanState {
    private ClientClanState() {}

    private static volatile ClanState current = ClanState.EMPTY;

    public static ClanState get() {
        return current;
    }

    public static void set(ClanState state) {
        current = state;
    }

    public static void reset() {
        current = ClanState.EMPTY;
    }

    public static boolean amLeader(UUID me) {
        return current.hasClan() && current.leader().equals(me);
    }
}
