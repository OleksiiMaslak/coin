import { extend } from '@pixi/react'
import { Container, Graphics, Sprite, Text } from 'pixi.js'

/**
 * Registers Pixi display objects so @pixi/react can render them via JSX intrinsic elements
 * like <pixiContainer />, <pixiGraphics />, <pixiSprite />, <pixiText />.
 */
extend({
  Container,
  Graphics,
  Sprite,
  Text,
})
