package dev.corelayer.clanmap.server;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Reine Clan-Logik ohne Minecraft-Abhaengigkeit. Ein Clan gehoert immer dem Spieler, der eingeladen hat
 * (dem Anfuehrer). Verlaesst der Anfuehrer den Clan, wird der Clan aufgeloest.
 */
public final class ClanManager {
    public static final long INVITE_TTL_MS = 5 * 60_000L;

    public record Result(String errorKey) {
        public static final Result OK = new Result(null);

        public boolean ok() {
            return errorKey == null;
        }

        static Result err(String key) {
            return new Result("clanmap.err." + key);
        }
    }

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Path file;
    /** Anfuehrer -> alle Mitglieder (inkl. Anfuehrer). */
    private final Map<UUID, Set<UUID>> clans = new HashMap<>();
    /** Mitglied -> Anfuehrer. */
    private final Map<UUID, UUID> leaderOf = new HashMap<>();
    /** Eingeladener -> (Einladender -> Ablaufzeit). Nur im Speicher, ueberlebt keinen Neustart. */
    private final Map<UUID, Map<UUID, Long>> invites = new HashMap<>();
    private final Map<UUID, String> names = new HashMap<>();

    public ClanManager(Path file) {
        this.file = file;
        load();
    }

    // ---- Abfragen ------------------------------------------------------------------------------------------

    public UUID leaderOf(UUID player) {
        return leaderOf.get(player);
    }

    public boolean isLeader(UUID player) {
        return player.equals(leaderOf.get(player));
    }

    /** Alle Mitglieder des Clans von {@code player} (inkl. ihm selbst), leer wenn ohne Clan. */
    public Set<UUID> clanOf(UUID player) {
        UUID leader = leaderOf.get(player);
        return leader == null ? Set.of() : Set.copyOf(clans.get(leader));
    }

    /** Einladende, die {@code invitee} gerade eingeladen haben. */
    public Set<UUID> pendingInvites(UUID invitee) {
        Map<UUID, Long> m = invites.get(invitee);
        if (m == null) {
            return Set.of();
        }
        long now = System.currentTimeMillis();
        m.values().removeIf(exp -> exp < now);
        if (m.isEmpty()) {
            invites.remove(invitee);
            return Set.of();
        }
        return Set.copyOf(m.keySet());
    }

    public String name(UUID id) {
        return names.getOrDefault(id, id.toString().substring(0, 8));
    }

    public void rememberName(UUID id, String name) {
        if (!name.equals(names.put(id, name)) && leaderOf.containsKey(id)) {
            save();
        }
    }

    // ---- Aktionen ------------------------------------------------------------------------------------------

    public Result invite(UUID inviter, UUID target) {
        if (inviter.equals(target)) {
            return Result.err("self");
        }
        UUID leader = leaderOf.get(inviter);
        if (leader != null && !leader.equals(inviter)) {
            return Result.err("not_leader");
        }
        if (leaderOf.containsKey(target)) {
            return Result.err("target_in_clan");
        }
        invites.computeIfAbsent(target, k -> new HashMap<>()).put(inviter, System.currentTimeMillis() + INVITE_TTL_MS);
        return Result.OK;
    }

    public Result accept(UUID invitee, UUID inviter) {
        if (leaderOf.containsKey(invitee)) {
            return Result.err("already_in_clan");
        }
        if (!pendingInvites(invitee).contains(inviter)) {
            return Result.err("no_invite");
        }
        UUID leader = leaderOf.get(inviter);
        if (leader != null && !leader.equals(inviter)) {
            // Der Einladende ist inzwischen nur noch Mitglied eines anderen Clans.
            invites.get(invitee).remove(inviter);
            return Result.err("no_invite");
        }
        if (leader == null) {
            clans.computeIfAbsent(inviter, k -> new LinkedHashSet<>()).add(inviter);
            leaderOf.put(inviter, inviter);
        }
        clans.get(inviter).add(invitee);
        leaderOf.put(invitee, inviter);
        invites.remove(invitee);
        save();
        return Result.OK;
    }

    public Result decline(UUID invitee, UUID inviter) {
        Map<UUID, Long> m = invites.get(invitee);
        if (m == null || m.remove(inviter) == null) {
            return Result.err("no_invite");
        }
        if (m.isEmpty()) {
            invites.remove(invitee);
        }
        return Result.OK;
    }

    /** Mitglied verlaesst den Clan; der Anfuehrer loest ihn damit auf. */
    public Result leave(UUID player) {
        UUID leader = leaderOf.get(player);
        if (leader == null) {
            return Result.err("not_in_clan");
        }
        if (leader.equals(player)) {
            for (UUID member : clans.remove(leader)) {
                leaderOf.remove(member);
            }
        } else {
            removeMember(leader, player);
        }
        save();
        return Result.OK;
    }

    public Result kick(UUID leader, UUID target) {
        if (!isLeader(leader)) {
            return Result.err("not_leader");
        }
        if (leader.equals(target) || !leader.equals(leaderOf.get(target))) {
            return Result.err("not_in_clan");
        }
        removeMember(leader, target);
        save();
        return Result.OK;
    }

    private void removeMember(UUID leader, UUID member) {
        Set<UUID> members = clans.get(leader);
        members.remove(member);
        leaderOf.remove(member);
        if (members.size() <= 1) {
            // Ein Clan nur aus dem Anfuehrer hat keinen Sinn mehr.
            clans.remove(leader);
            leaderOf.remove(leader);
        }
    }

    // ---- Persistenz ----------------------------------------------------------------------------------------

    private void load() {
        if (!Files.exists(file)) {
            return;
        }
        try {
            JsonObject root = GSON.fromJson(Files.readString(file, StandardCharsets.UTF_8), JsonObject.class);
            for (JsonElement el : root.getAsJsonArray("clans")) {
                JsonObject c = el.getAsJsonObject();
                UUID leader = UUID.fromString(c.get("leader").getAsString());
                Set<UUID> members = new LinkedHashSet<>();
                for (JsonElement m : c.getAsJsonArray("members")) {
                    UUID id = UUID.fromString(m.getAsString());
                    members.add(id);
                    leaderOf.put(id, leader);
                }
                clans.put(leader, members);
            }
            for (Map.Entry<String, JsonElement> e : root.getAsJsonObject("names").entrySet()) {
                names.put(UUID.fromString(e.getKey()), e.getValue().getAsString());
            }
        } catch (IOException | RuntimeException e) {
            System.err.println("[clanmap] clans.json konnte nicht gelesen werden: " + e);
        }
    }

    private void save() {
        JsonObject root = new JsonObject();
        JsonArray arr = new JsonArray();
        for (Map.Entry<UUID, Set<UUID>> c : clans.entrySet()) {
            JsonObject o = new JsonObject();
            o.addProperty("leader", c.getKey().toString());
            JsonArray members = new JsonArray();
            c.getValue().forEach(m -> members.add(m.toString()));
            o.add("members", members);
            arr.add(o);
        }
        root.add("clans", arr);
        JsonObject n = new JsonObject();
        leaderOf.keySet().forEach(id -> n.addProperty(id.toString(), name(id)));
        root.add("names", n);
        try {
            Files.writeString(file, GSON.toJson(root), StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("[clanmap] clans.json konnte nicht geschrieben werden: " + e);
        }
    }
}
