import React from 'react';
import Dragula from 'dragula';
import 'dragula/dist/dragula.css';
import Swimlane from './Swimlane';
import './Board.css';

const API_URL = 'http://localhost:3001/api/v1';

export default class Board extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clients: {
        backlog: [],
        inProgress: [],
        complete: [],
      },
      loading: true,
    }
    this.swimlanes = {
      backlog: React.createRef(),
      inProgress: React.createRef(),
      complete: React.createRef(),
    }
  }

  componentDidMount() {
    this.initDragula();
    this.loadClients();
  }

  componentWillUnmount() {
    try {
      if (this.drake) {
        this.drake.destroy();
      }
    } catch (e) {
      // Ignore Dragula cleanup errors during unmount
    }
  }

  initDragula() {
    const containers = [
      this.swimlanes.backlog.current,
      this.swimlanes.inProgress.current,
      this.swimlanes.complete.current,
    ];
    this.drake = Dragula(containers);
    this.drake.on('drop', (el, target, source, sibling) => {
      this.drake.cancel(true);
      this.handleDrop(el, target, sibling);
    });
  }

  loadClients() {
    fetch(`${API_URL}/clients`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(clients => {
        const statusMap = {
          backlog: 'backlog',
          'in-progress': 'inProgress',
          complete: 'complete',
        };
        const grouped = {
          backlog: [],
          inProgress: [],
          complete: [],
        };
        clients.forEach(client => {
          const key = statusMap[client.status];
          if (key) {
            grouped[key].push(client);
          }
        });
        Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => a.priority - b.priority);
        });
        this.setState({ clients: grouped, loading: false });
      })
      .catch(err => {
        console.error('Failed to load clients:', err);
        this.setState({ loading: false });
      });
  }

  laneKeyForContainer(container) {
    for (const key of Object.keys(this.swimlanes)) {
      if (this.swimlanes[key].current === container) {
        return key;
      }
    }
    return null;
  }

  handleDrop(el, target, sibling) {
    const targetKey = this.laneKeyForContainer(target);
    const draggedId = parseInt(el.getAttribute('data-id'), 10);

    const statusMap = {
      backlog: 'backlog',
      inProgress: 'in-progress',
      complete: 'complete',
    };
    const newStatus = statusMap[targetKey];

    let draggedClient = null;
    for (const key of Object.keys(this.state.clients)) {
      draggedClient = this.state.clients[key].find(c => c.id === draggedId);
      if (draggedClient) break;
    }

    if (!draggedClient) return;

    draggedClient = { ...draggedClient, status: newStatus };

    const newClients = {};
    for (const key of Object.keys(this.state.clients)) {
      newClients[key] = this.state.clients[key].filter(c => c.id !== draggedId);
    }

    let insertIndex = newClients[targetKey].length;
    if (sibling) {
      const siblingId = parseInt(sibling.getAttribute('data-id'), 10);
      const siblingIndex = newClients[targetKey].findIndex(c => c.id === siblingId);
      if (siblingIndex !== -1) {
        insertIndex = siblingIndex;
      }
    }

    newClients[targetKey].splice(insertIndex, 0, draggedClient);
    const newPriority = insertIndex + 1;

    this.setState({ clients: newClients });

    fetch(`${API_URL}/clients/${draggedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, priority: newPriority }),
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .catch(err => {
        console.error('Failed to update client:', err);
      });
  }

  renderSwimlane(name, clients, ref, status) {
    return (
      <Swimlane name={name} clients={clients} dragulaRef={ref} status={status}/>
    );
  }

  render() {
    if (this.state.loading) {
      return <div className="Board">Loading...</div>;
    }

    return (
      <div className="Board">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-4">
              {this.renderSwimlane('Backlog', this.state.clients.backlog, this.swimlanes.backlog, 'backlog')}
            </div>
            <div className="col-md-4">
              {this.renderSwimlane('In Progress', this.state.clients.inProgress, this.swimlanes.inProgress, 'in-progress')}
            </div>
            <div className="col-md-4">
              {this.renderSwimlane('Complete', this.state.clients.complete, this.swimlanes.complete, 'complete')}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
