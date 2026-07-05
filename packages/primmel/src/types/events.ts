export default interface EventNode {
  id: string;
  eventType: 'start' | 'end' | 'signalcatch' | 'timer';
}

export interface StartEvent extends EventNode {
  eventType: 'start';
}

export interface EndEvent extends EventNode {
  eventType: 'end';
}

export interface SignalCatchEvent extends EventNode {
  eventType: 'signalcatch';
  signal: string;
}

export interface TimerEvent extends EventNode {
  eventType: 'timer';

  // Timer information
  type: string;
  para: string;
}
