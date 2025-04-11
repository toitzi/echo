import { NullConnector } from '../src/connector';

// Create a helper function to get a fresh module for each test
const getEchoModule = () => {
  jest.resetModules();
  return require('../src/hook/use-echo');
};

describe('Echo Configuration', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('it throws error when Echo is not configured', () => {
    const { echo } = getEchoModule();
    expect(() => echo()).toThrow(
      'Echo has not been configured'
    );
  });

  test('it creates Echo instance with proper configuration', () => {
    const { configureEcho, echo } = getEchoModule();
    const mockConfig = { broadcaster: 'null', Connector: NullConnector };
    configureEcho(mockConfig);
    expect(echo()).toBeDefined();
  });
});


describe('Channel Subscription', () => {
    let echoModule;
    
    beforeEach(() => {
      jest.resetModules();
      echoModule = getEchoModule();
      const mockConfig = { broadcaster: 'null', Connector: NullConnector };
      echoModule.configureEcho(mockConfig);
    });
  
    test('it subscribes to public channel correctly', () => {
      const { useEcho, echo } = echoModule;
      const mockCallback = jest.fn();
      const mockChannel = { listen: jest.fn(), stopListening: jest.fn() };
      
      // Mock the channel method to return our mock channel
      jest.spyOn(echo(), 'channel').mockReturnValue(mockChannel);
      
      useEcho({ 
        channel: 'test-channel', 
        event: 'test-event', 
        callback: mockCallback,
        visibility: 'public'
      });
      
      // Verify channel was called with correct name
      expect(echo().channel).toHaveBeenCalledWith('test-channel');
      // Verify listen was called on the channel
      expect(mockChannel.listen).toHaveBeenCalledWith('test-event', expect.any(Function));
    });
  });