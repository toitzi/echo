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