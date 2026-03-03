import { View } from 'react-native';
import Auth from '@/src/components/Auth';
import { useTheme } from '@/src/context/ThemeContext';

export default function AuthScreen() {
    const { theme } = useTheme();
    return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <Auth />
        </View>
    );
}
