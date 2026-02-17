export type CoinSide = 'heads' | 'tails'

export type GameStatus = 'idle' | 'flipping' | 'message'

export type GameMessage = 'You Win!' | 'You Lose!' | null

export interface GameState {
  status: GameStatus
  roundId: number
  playerChoice: CoinSide | null
  apiResult: CoinSide | null
  isLoading: boolean
  message: GameMessage
}
