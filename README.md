# ghostboards

ghostboards is an interactive application designed to improve spatial recall, blindfold calculation, and pattern recognition through targeted chess memory exercises.

---

## Key Features

### Game Modes

* **Classic Trainer:** Offers Easy (endgame studies), Medium (tactical middlegames), and Hard (famous master games) difficulty levels with configurable display timers (5 to 30 seconds).
* **Blitz Rush:** A 60-second timed mode requiring users to memorize and reconstruct as many positions as possible within the time limit.
* **Daily Challenge:** Features a daily master puzzle with persistent streak tracking.
* **Custom Position Lab:** Allows users to input and test custom FEN strings from personal games, opening repertoires, or tactical studies.

### Evaluation Tools

* **Visual Diff Inspector:** Displays board reconstruction accuracy using three viewing options: Overlay Diff, Your Board, and Actual Solution.
* **Visual Markers:** Indicates correct placements with green indicators, misplaced pieces with red alerts, and omitted pieces with ghost overlays.

### Controls and Shortcuts

* **Input Options:** Supports drag-and-drop piece placement, click-to-place board interaction, and direct piece movement across squares.
* **Keyboard Shortcuts:**
* `1`–`6`: Select piece type (Pawn, Knight, Bishop, Rook, Queen, King)
* `Tab` / `Shift`: Toggle active piece color (White / Black)
* `E` / `Backspace`: Activate eraser tool
* `Right Click`: Clear targeted square
* `Z`: Undo last action
* `C`: Clear board
* `H`: Reveal a one-piece hint
* `F`: Flip board orientation
* `M`: Toggle audio effects
* `Space` / `Enter`: Start round, submit board, or advance to the next puzzle



### Audio and Performance

* **Synthesized Audio:** Uses Web Audio API to generate sound effects for board interactions, timer prompts, and evaluation results without external dependencies.

### Analytics and Storage

* **Performance Metrics:** Tracks accuracy rates, total rounds completed, perfect recall counts, current and highest streaks, and Blitz mode scores.
* **Piece Breakdown:** Displays historical accuracy statistics categorized by individual piece type.
* **Local Persistence:** Automatically saves user progress and round history locally.

### Interface Customization

* **Board Themes:** Includes Classic Wood, Tournament Green, Oceanic Midnight, Modern Slate, Warm Sand, and Vintage Maple themes, alongside a custom color picker.
* **Visual Indicators:** Features progress rings for timer countdowns and customizable board aesthetics.

---

## Local Setup

Run a local static web server to launch the application:

```bash
python3 -m http.server 8080

```

Navigate to `http://localhost:8080` in a web browser.