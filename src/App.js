import logo from './logo.svg';
import './App.css';
import PTZCamera from './PTZCamera';

const App = () => {
    return (
        <div style={{ textAlign: 'center' }}>
            <h1>PTZ Camera Control</h1>
            <PTZCamera />
        </div>
    );
};
export default App;
