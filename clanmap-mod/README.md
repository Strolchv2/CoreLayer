# Clan Map Sync (Fabric, Minecraft 26.3)

Menü mit allen Spielern des Servers, Clan-Einladungen und Kartensynchronisation zwischen Clanmitgliedern.
Läuft neben Xaero's World Map und Xaero's Minimap, ohne deren Tastenbelegung zu überschreiben.

## Bedienung

| Aktion | Wie |
| --- | --- |
| Menü öffnen | **Numpad-Minus** (Standard) |
| Hotkey ändern | Optionen → Steuerung → Tastenbelegung → *Clan Map Sync* |
| Spieler einladen | Menü, linke Spalte, **Einladen** |
| Einladung annehmen/ablehnen | Menü, rechte Spalte (Einladung läuft nach 5 Minuten ab) |
| Clan verlassen | Menü, rechte Spalte, **Clan verlassen** → Sync stoppt sofort |

Regeln:

- Der Clan gehört dem, der eingeladen hat (Anführer). Nur der Anführer lädt ein und kann Mitglieder entfernen.
- Wer schon in einem Clan ist, kann nicht eingeladen werden.
- Verlässt der Anführer den Clan, wird er für alle aufgelöst. Ein Clan, der nur noch aus dem Anführer besteht, auch.
- Einladbar sind nur Spieler, die die Mod ebenfalls installiert haben (andere zeigt das Menü mit `[ohne Mod]`).
- Die Mod muss auf **Server und Clients** installiert sein. Clans werden pro Welt in `clanmap-clans.json` gespeichert.

## Bauen

Voraussetzungen: Java 25 und Gradle 9.x (so wie es das Fabric-Template für 26.x vorgibt).
Den Gradle-Wrapper (`gradlew`, `gradle/wrapper/`) bitte aus dem Template von <https://fabricmc.net/develop>
für 26.3 übernehmen und dort auch die Versionen in `gradle.properties` abgleichen.

```
./gradlew build        # erzeugt build/libs/clanmap-0.1.0.jar
./gradlew test         # Clan-Logik
./gradlew runClient    # Testclient
```

## Stand

- Getestet (JUnit, ohne Minecraft): die Clan-Logik in `ClanManager` (Einladen, Annehmen, Verlassen, Entfernen, Speichern).
- **Nicht kompiliert und nicht im Spiel getestet**: alles, was Minecraft/Fabric-APIs von 26.3 benutzt. Beim ersten
  Build sind kleine Namensabweichungen möglich (siehe unten).
- **Xaero-Anbindung fehlt noch.** Die Mod scannt Chunks zu 16×16-Farbkacheln, sendet sie an den Clan und reicht
  empfangene Kacheln an registrierte `MapTileSink`s weiter (`MapSync.registerSink`). Xaero hat keine öffentliche API
  zum Einspeisen von Kartendaten; der Adapter, der die Kacheln in World Map/Minimap einträgt, braucht die echten
  Xaero-Jars für 26.3 und ist der nächste Schritt.

### Stellen, die beim ersten Build am ehesten abweichen

- `build.gradle` / `gradle.properties`: Loom-Plugin-ID und -Version, `loader_version`.
- `ClanMapClient`: `KeyMappingHelper` (Paket `...client.keymapping.v1`), `KeyMapping.Category.register`.
- `MapSync`: `ChunkPos.x()/z()`, `ResourceKey.identifier()`, `BlockState.getMapColor`.
- `ClanScreen`: `PlayerInfo.getProfile()` (`GameProfile.id()/name()`).
