"""
**********************************************************************************
* Title: ui_elements.py
*
* Metadata:
* @author Joseph Bryant
* @refactored by Isaiah Tadrous
* @version 1.5.0
* -------------------------------------------------------------------------------
* Description:
* This module contains classes for creating reusable user interface elements
* for the Pygame application. The primary element defined here is the Button
* class, which encapsulates the logic for rendering, handling mouse-over
* (hover) states, click events, and disabled states. This component-based
* approach helps in building a clean and maintainable UI panel.
*
**********************************************************************************
"""
# ui_elements.py
# Description: Contains classes for UI elements like buttons.

# --- IMPORTS ---
import pygame

# --- BUTTON CLASS DEFINITION ---
class Button:
    """
    A class to create and manage clickable buttons in the UI.

    This class handles drawing the button, detecting hover and click events,
    and managing a disabled state.
    """
    def __init__(self, rect, text, action_id, font, colors):
        """
        Initializes a Button object.

        :param pygame.Rect rect: The position and dimensions of the button.
        :param str text: The text to display on the button.
        :param str action_id: A unique identifier for the button's action (e.g., 'new', 'back').
        :param pygame.font.Font font: The font to use for the button text.
        :param dict colors: A dictionary of colors for different states (e.g., 'base', 'hover', 'text').
        """
        self.rect = rect
        self.text = text
        self.action_id = action_id
        self.font = font
        self.colors = colors
        
        self.is_hovered = False
        self.is_disabled = False

    def handle_event(self, event):
        """
        Handles mouse events for the button, checking for hover and clicks.

        :param pygame.event.Event event: The Pygame event to process.
        :returns Optional[str]: The action_id if the button is clicked, otherwise None.
        """
        self.is_hovered = self.rect.collidepoint(pygame.mouse.get_pos())
        
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.is_hovered and not self.is_disabled:
            return self.action_id
        return None

    def draw(self, screen):
        """
        Draws the button on the specified screen surface.

        The button's appearance changes based on its state (normal, hovered,
        or disabled).

        :param pygame.Surface screen: The screen or surface to draw the button on.
        :returns None:
        """
        if self.is_disabled:
            bg_color = self.colors['disabled_bg']
            text_color = self.colors['disabled_fg']
        else:
            bg_color = self.colors['hover'] if self.is_hovered else self.colors['base']
            text_color = self.colors['text']

        pygame.draw.rect(screen, bg_color, self.rect, border_radius=8)
        
        text_surf = self.font.render(self.text, True, text_color)
        text_rect = text_surf.get_rect(center=self.rect.center)
        screen.blit(text_surf, text_rect)
