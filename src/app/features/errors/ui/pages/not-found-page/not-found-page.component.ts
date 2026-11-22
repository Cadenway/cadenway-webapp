import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CwButton } from '@cadenway/ui/components/button';
import { NgIcon } from '@ng-icons/core';

/**
 * Class NotFoundPage
 *
 * @description
 * Provides the application's protected page for an unknown route.
 */
@Component({
  selector: 'cw-not-found-page',
  imports: [CwButton, NgIcon, RouterLink],
  templateUrl: './not-found-page.component.html',
})
export class NotFoundPage {}
