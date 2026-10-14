package dev.corelayer.clanmap.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClanManagerTest {
    @TempDir Path dir;
    ClanManager m;
    final UUID a = UUID.randomUUID(), b = UUID.randomUUID(), c = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        m = new ClanManager(dir.resolve("clans.json"));
        m.rememberName(a, "Anna");
        m.rememberName(b, "Ben");
        m.rememberName(c, "Cem");
    }

    @Test
    void inviterBecomesLeaderOnAccept() {
        assertTrue(m.invite(a, b).ok());
        assertTrue(m.accept(b, a).ok());
        assertTrue(m.isLeader(a));
        assertFalse(m.isLeader(b));
        assertEquals(Set.of(a, b), m.clanOf(a));
        assertEquals(Set.of(a, b), m.clanOf(b));
    }

    @Test
    void cannotInviteSelfOrClanMemberOrAsNonLeader() {
        assertEquals("clanmap.err.self", m.invite(a, a).errorKey());
        m.invite(a, b); m.accept(b, a);
        assertEquals("clanmap.err.target_in_clan", m.invite(a, b).errorKey());
        assertEquals("clanmap.err.not_leader", m.invite(b, c).errorKey());
    }

    @Test
    void acceptNeedsInvite() {
        assertEquals("clanmap.err.no_invite", m.accept(b, a).errorKey());
    }

    @Test
    void declineRemovesInvite() {
        m.invite(a, b);
        assertTrue(m.decline(b, a).ok());
        assertEquals("clanmap.err.no_invite", m.accept(b, a).errorKey());
    }

    @Test
    void memberLeavingEndsOnlyTheirSync() {
        m.invite(a, b); m.accept(b, a);
        m.invite(a, c); m.accept(c, a);
        assertTrue(m.leave(b).ok());
        assertEquals(Set.of(), m.clanOf(b));
        assertEquals(Set.of(a, c), m.clanOf(a));
    }

    @Test
    void lastMemberLeavingDissolvesClan() {
        m.invite(a, b); m.accept(b, a);
        m.leave(b);
        assertNull(m.leaderOf(a));
        assertEquals(Set.of(), m.clanOf(a));
    }

    @Test
    void leaderLeavingDisbandsEveryone() {
        m.invite(a, b); m.accept(b, a);
        m.invite(a, c); m.accept(c, a);
        assertTrue(m.leave(a).ok());
        assertEquals(Set.of(), m.clanOf(b));
        assertEquals(Set.of(), m.clanOf(c));
    }

    @Test
    void kickOnlyByLeader() {
        m.invite(a, b); m.accept(b, a);
        m.invite(a, c); m.accept(c, a);
        assertEquals("clanmap.err.not_leader", m.kick(b, c).errorKey());
        assertTrue(m.kick(a, c).ok());
        assertEquals(Set.of(a, b), m.clanOf(a));
    }

    @Test
    void persistsAcrossRestart() {
        m.invite(a, b); m.accept(b, a);
        ClanManager reloaded = new ClanManager(dir.resolve("clans.json"));
        assertEquals(Set.of(a, b), reloaded.clanOf(b));
        assertTrue(reloaded.isLeader(a));
        assertEquals("Anna", reloaded.name(a));
    }
}
