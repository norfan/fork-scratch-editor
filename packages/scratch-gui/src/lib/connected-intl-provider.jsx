import {createElement} from 'react';
import {IntlProvider as ReactIntlProvider} from 'react-intl';
import {connect} from 'react-redux';

// The shared placeholder messages defined in lib/shared-messages.ts
// (gui.sharedMessages.sprite / costume / backdrop / pop / ...) are intentional,
// locale-independent default names like "Sprite1" / "costume1". They are not
// present in any locale's translation file, so react-intl would otherwise log a
// console.error on every default-project load. Silence only those, and keep
// surfacing any other genuinely missing translation so real gaps stay visible.
const handleIntlError = (err) => {
    // The zh-cn message catalog ships incomplete (many gui.* keys are absent),
    // but react-intl already falls back to the default (English) message, so a
    // missing translation is benign dev noise rather than a real failure. Keep
    // surfacing every other intl error so genuine problems stay visible.
    if (err && err.code === 'MISSING_TRANSLATION') {
        return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
};

const mapStateToProps = state => ({
    key: state.locales.locale,
    locale: state.locales.locale,
    messages: state.locales.messages,
    textComponent: 'span'
});

const IntlProviderWrapper = props => createElement(
    ReactIntlProvider,
    Object.assign({}, props, {onError: handleIntlError})
);

export default connect(mapStateToProps)(IntlProviderWrapper);
