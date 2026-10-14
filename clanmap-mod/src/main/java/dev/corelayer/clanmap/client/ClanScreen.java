package dev.corelayer.clanmap.client;

import dev.corelayer.clanmap.net.Packets;
import dev.corelayer.clanmap.net.Packets.Action;
import dev.corelayer.clanmap.net.Packets.ClanState;
import dev.corelayer.clanmap.net.Packets.Entry;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.StringWidget;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Component;

/**
 * Das Clan-Menue. Bewusst nur aus Standard-Widgets gebaut (kein eigenes Rendering), damit es unabhaengig von
 * Aenderungen an der GUI-Render-API bleibt. Links: alle Spieler auf dem Server. Rechts: Clan und Einladungen.
 */
public final class ClanScreen extends Screen {
    private static final int ROW_H = 22;
    private static final int PER_PAGE = 8;
    private static final int COL_W = 190;

    private int page;
    private int lastPlayerHash;

    public ClanScreen() {
        super(Component.translatable("clanmap.screen.title"));
    }

    /** Vom Netzwerk-Handler aufgerufen, sobald ein neuer Clan-Zustand da ist. */
    public void refresh() {
        rebuildWidgets();
    }

    @Override
    public void tick() {
        // Spielerliste aendert sich, wenn jemand joint/geht.
        int hash = onlinePlayers().stream().map(PlayerInfo::getProfile).map(p -> p.id()).toList().hashCode();
        if (hash != lastPlayerHash) {
            rebuildWidgets();
        }
    }

    @Override
    protected void init() {
        Minecraft mc = Minecraft.getInstance();
        ClanState st = ClientClanState.get();
        UUID me = mc.player.getUUID();
        boolean amLeader = ClientClanState.amLeader(me);
        boolean canInvite = !st.hasClan() || amLeader;

        int cx = width / 2;
        int left = cx - COL_W - 10;
        int right = cx + 10;

        label(cx - 150, 12, 300, title).alignCenter();

        // ---- Linke Spalte: Spieler ----
        label(left, 34, COL_W, Component.translatable("clanmap.screen.players"));
        List<PlayerInfo> players = onlinePlayers().stream()
                .filter(p -> !p.getProfile().id().equals(me))
                .toList();
        lastPlayerHash = onlinePlayers().stream().map(p -> p.getProfile().id()).toList().hashCode();

        int pages = Math.max(1, (players.size() + PER_PAGE - 1) / PER_PAGE);
        page = Math.min(Math.max(page, 0), pages - 1);

        if (players.isEmpty()) {
            label(left, 56, COL_W, Component.translatable("clanmap.screen.no_players"));
        }
        for (int i = 0; i < PER_PAGE; i++) {
            int idx = page * PER_PAGE + i;
            if (idx >= players.size()) {
                break;
            }
            PlayerInfo info = players.get(idx);
            UUID id = info.getProfile().id();
            int y = 50 + i * ROW_H;
            label(left, y + 6, 105, Component.literal(info.getProfile().name()));

            if (isMember(st, id)) {
                label(left + 108, y + 6, 82, Component.translatable("clanmap.tag.in_clan"));
            } else if (!st.modPlayers().contains(id)) {
                label(left + 108, y + 6, 82, Component.translatable("clanmap.tag.no_mod"));
            } else if (canInvite) {
                addRenderableWidget(Button.builder(Component.translatable("clanmap.button.invite"),
                                b -> send(Action.INVITE, id))
                        .bounds(left + 108, y, 82, 20).build());
            }
        }
        int navY = 50 + PER_PAGE * ROW_H + 4;
        Button prev = addRenderableWidget(Button.builder(Component.translatable("clanmap.button.prev"), b -> {
            page--;
            rebuildWidgets();
        }).bounds(left, navY, 24, 20).build());
        Button next = addRenderableWidget(Button.builder(Component.translatable("clanmap.button.next"), b -> {
            page++;
            rebuildWidgets();
        }).bounds(left + COL_W - 24, navY, 24, 20).build());
        prev.active = page > 0;
        next.active = page < pages - 1;
        label(left + 28, navY + 6, COL_W - 56,
                Component.translatable("clanmap.screen.page", page + 1, pages)).alignCenter();

        // ---- Rechte Spalte: Clan ----
        int y = 34;
        if (!st.hasClan()) {
            label(right, y, COL_W, Component.translatable("clanmap.screen.clan_none"));
            y += ROW_H;
        } else {
            String leaderName = st.members().stream()
                    .filter(e -> e.id().equals(st.leader())).map(Entry::name).findFirst().orElse("?");
            label(right, y, COL_W, Component.translatable("clanmap.screen.clan_of", leaderName));
            label(right, y + 12, COL_W, Component.translatable("clanmap.sync.on"));
            y += 30;
            label(right, y, COL_W, Component.translatable("clanmap.screen.members"));
            y += 14;
            for (Entry member : st.members()) {
                boolean isLeader = member.id().equals(st.leader());
                label(right, y + 6, 110, Component.literal(member.name() + " ")
                        .append(Component.translatable(isLeader ? "clanmap.tag.leader" : "clanmap.tag.member")));
                if (amLeader && !isLeader) {
                    UUID id = member.id();
                    addRenderableWidget(Button.builder(Component.translatable("clanmap.button.kick"),
                                    b -> send(Action.KICK, id))
                            .bounds(right + 130, y, 60, 20).build());
                }
                y += ROW_H;
            }
            addRenderableWidget(Button.builder(
                            Component.translatable(amLeader ? "clanmap.button.disband" : "clanmap.button.leave"),
                            b -> send(Action.LEAVE, Packets.NONE))
                    .bounds(right, y + 2, COL_W, 20).build());
            y += ROW_H + 10;
        }

        if (!st.invites().isEmpty()) {
            label(right, y, COL_W, Component.translatable("clanmap.screen.invites"));
            y += 14;
            for (Entry inv : st.invites()) {
                UUID id = inv.id();
                label(right, y + 6, 70, Component.literal(inv.name()));
                addRenderableWidget(Button.builder(Component.translatable("clanmap.button.accept"),
                                b -> send(Action.ACCEPT, id))
                        .bounds(right + 72, y, 60, 20).build());
                addRenderableWidget(Button.builder(Component.translatable("clanmap.button.decline"),
                                b -> send(Action.DECLINE, id))
                        .bounds(right + 134, y, 56, 20).build());
                y += ROW_H;
            }
        }

        addRenderableWidget(Button.builder(Component.translatable("clanmap.button.close"), b -> onClose())
                .bounds(cx - 50, height - 28, 100, 20).build());
    }

    private StringWidget label(int x, int y, int w, Component text) {
        return addRenderableOnly(new StringWidget(x, y, w, 10, text, font));
    }

    private static boolean isMember(ClanState st, UUID id) {
        return st.members().stream().anyMatch(e -> Objects.equals(e.id(), id));
    }

    private static List<PlayerInfo> onlinePlayers() {
        var connection = Minecraft.getInstance().getConnection();
        if (connection == null) {
            return List.of();
        }
        return connection.getOnlinePlayers().stream()
                .sorted(Comparator.comparing(p -> p.getProfile().name().toLowerCase()))
                .toList();
    }

    private static void send(Action action, UUID target) {
        if (ClientPlayNetworking.canSend(Packets.ClanAction.TYPE)) {
            ClientPlayNetworking.send(new Packets.ClanAction(action, target));
        }
    }
}
