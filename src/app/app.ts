import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component: it only hosts the router outlet; the shell lives in `core/`. */
@Component({
  imports: [RouterOutlet],
  selector: 'wp-root',
  templateUrl: './app.html',
})
export class App {}
